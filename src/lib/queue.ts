import { db } from '@/lib/db'
import { getSettings } from '@/lib/settings'
import {
  stepDispatchForm,
  stepCreateContract,
  stepCreatePayment,
  pollAutentique,
  pollAsaas,
} from '@/lib/pipeline'

/**
 * Motor da fila: processa UMA ação por tick, sempre na ordem do fluxo.
 * - disparo dos e-mails de formulário (1 por vez, respeitando o intervalo)
 * - geração de contrato para formulários recebidos
 * - criação de cobrança para contratos assinados
 * - sondagem periódica da Autentique e do Asaas (fallback dos webhooks)
 */

type QueueState = {
  running: boolean
  lastSendAt: number
  lastAutentiquePoll: number
  lastAsaasPoll: number
  lastRetentionAt: number
  intervalStarted: boolean
}

const RETENTION_DAYS = 90
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000

const globalForQueue = globalThis as unknown as { __queueState?: QueueState }

function state(): QueueState {
  if (!globalForQueue.__queueState) {
    globalForQueue.__queueState = {
      running: false,
      lastSendAt: 0,
      lastAutentiquePoll: 0,
      lastAsaasPoll: 0,
      lastRetentionAt: 0,
      intervalStarted: false,
    }
  }
  return globalForQueue.__queueState
}

let lastTickResult = {
  at: 0,
  action: 'idle' as string,
  detail: '' as string,
}

export function getLastTick() {
  return lastTickResult
}

export async function tick(): Promise<void> {
  const s = state()
  if (s.running) return
  s.running = true
  try {
    const settings = await getSettings()
    const now = Date.now()

    // 1) disparo do formulário — um e-mail por vez, com intervalo configurável
    if (now - s.lastSendAt >= settings.queueDelaySeconds * 1000) {
      const next = await db.recipient.findFirst({
        where: { status: 'fila', process: { status: 'disparando' } },
        orderBy: [{ process: { createdAt: 'asc' } }, { createdAt: 'asc' }],
      })
      if (next) {
        await stepDispatchForm(next.id)
        s.lastSendAt = Date.now()
        lastTickResult = { at: Date.now(), action: 'disparo_form', detail: `${next.name} <${next.email}>` }
        return
      }
    }

    // 2) formulários recebidos aguardando geração de contrato
    const pendingContract = await db.recipient.findFirst({
      where: { status: 'form_recebido' },
      orderBy: { submittedAt: 'asc' },
    })
    if (pendingContract) {
      await stepCreateContract(pendingContract.id)
      lastTickResult = { at: Date.now(), action: 'gerando_contrato', detail: pendingContract.name }
      return
    }

    // 3) contratos assinados aguardando cobrança
    const pendingPayment = await db.recipient.findFirst({
      where: { status: 'assinado' },
      orderBy: { signedAt: 'asc' },
    })
    if (pendingPayment) {
      await stepCreatePayment(pendingPayment.id)
      lastTickResult = { at: Date.now(), action: 'gerando_cobranca', detail: pendingPayment.name }
      return
    }

    // 4) sondagem Autentique (fallback do webhook)
    if (now - s.lastAutentiquePoll >= settings.pollMinutes * 60 * 1000) {
      s.lastAutentiquePoll = now
      const hasPending = await db.recipient.count({ where: { status: 'contrato_enviado', autentiqueDocId: { not: null } } })
      if (hasPending > 0) {
        await pollAutentique()
        lastTickResult = { at: Date.now(), action: 'sondagem_autentique', detail: `${hasPending} aguardando assinatura` }
        return
      }
    }

    // 5) sondagem Asaas (fallback do webhook)
    if (now - s.lastAsaasPoll >= settings.pollMinutes * 60 * 1000) {
      s.lastAsaasPoll = now
      const hasPending = await db.recipient.count({ where: { status: 'pagamento_enviado', asaasPaymentId: { not: null } } })
      if (hasPending > 0) {
        await pollAsaas()
        lastTickResult = { at: Date.now(), action: 'sondagem_asaas', detail: `${hasPending} aguardando pagamento` }
        return
      }
    }

    // 6) retenção: expurga logs com mais de 90 dias (LGPD — minimização;
    // também impede o SQLite crescer indefinidamente com WebhookLog)
    if (now - s.lastRetentionAt >= RETENTION_INTERVAL_MS) {
      s.lastRetentionAt = now
      const cutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000)
      const delWebhooks = await db.webhookLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
      const delEmails = await db.emailLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
      if (delWebhooks.count + delEmails.count > 0) {
        lastTickResult = {
          at: Date.now(),
          action: 'retencao',
          detail: `${delEmails.count} EmailLog + ${delWebhooks.count} WebhookLog (>90d)`,
        }
        return
      }
    }

    lastTickResult = { at: Date.now(), action: 'idle', detail: '' }
  } catch {
    // erros de tick são logados nos destinatários individuais
  } finally {
    s.running = false
  }
}

/** Inicia o intervalo automático (chamado na primeira requisição servida). */
export function ensureQueueInterval(): void {
  const s = state()
  if (s.intervalStarted) return
  s.intervalStarted = true
  const timer = setInterval(() => {
    void tick()
  }, 10_000)
  // não segura o processo
  if (typeof timer.unref === 'function') timer.unref()
}
