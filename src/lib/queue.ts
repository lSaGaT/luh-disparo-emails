import { db } from '@/lib/db'
import { getSettings } from '@/lib/settings'
import {
  stepDispatchForm,
  stepCreateContract,
  stepBackfillSignLink,
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
  catchUpDone: boolean
  timer?: ReturnType<typeof setInterval>
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
      catchUpDone: false,
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

/** Estados que ainda exigem ação da fila. 'pago' é o único fim de linha;
 * erros de outras etapas esperam ação manual e não mantêm a fila viva. */
async function hasPendingWork(): Promise<boolean> {
  const c = await db.recipient.count({
    where: {
      OR: [
        { status: 'fila' },
        { status: 'form_recebido' },
        { status: 'contrato_enviado' },
        { status: 'assinado' },
        { status: 'pagamento_enviado' },
        { status: 'erro', stage: 'contract' },
      ],
    },
  })
  return c > 0
}

/** Desliga o timer da fila; a próxima requisição autenticada religa sozinha
 * (ensureQueueInterval roda a cada requisição servida). */
function stopInterval(): void {
  const s = state()
  if (s.timer) {
    clearInterval(s.timer)
    s.timer = undefined
  }
  s.intervalStarted = false
}

export async function tick(): Promise<void> {
  const s = state()
  if (s.running) return
  s.running = true
  try {
    // nada pendente: fila desligada (religa sozinha quando surgir trabalho)
    if (!(await hasPendingWork())) {
      stopInterval()
      lastTickResult = { at: Date.now(), action: 'ociosa', detail: 'sem pendências' }
      return
    }

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

    // 2.5) link de assinatura pendente (Autentique gera o short_link de forma
    // assíncrona — quando chegar, grava, normaliza o falso erro e dispara o
    // e-mail). Só consome o tick se agiu; senão segue para as próximas etapas.
    const pendingLink = await db.recipient.findFirst({
      where: {
        autentiqueDocId: { not: null },
        signUrl: null,
        OR: [{ status: 'contrato_enviado' }, { status: 'erro', stage: 'contract' }],
      },
      orderBy: { contractSentAt: 'asc' },
    })
    if (pendingLink && (await stepBackfillSignLink(pendingLink.id))) {
      lastTickResult = { at: Date.now(), action: 'link_assinatura', detail: pendingLink.name }
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

    // 4) sondagem Autentique (fallback do webhook) — cobre os mesmos estados
    // que o pollAutentique trata, inclusive erros de contrato
    if (now - s.lastAutentiquePoll >= settings.pollMinutes * 60 * 1000) {
      s.lastAutentiquePoll = now
      const hasPending = await db.recipient.count({
        where: {
          autentiqueDocId: { not: null },
          OR: [{ status: 'contrato_enviado' }, { status: 'erro', stage: 'contract' }],
        },
      })
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
  s.timer = timer
}

/** Varredura de abertura ("captura"): o sistema pode ficar horas desligado
 * (rotina da operadora — liga de manhã, desliga à noite). Ao subir, consulta
 * Autentique e Asaas imediatamente para reconhecer assinaturas e pagamentos
 * que aconteceram no intervalo desligado, e religa o ciclo da fila. Roda
 * algumas rodadas porque cada sondagem processa em lote; o restante segue no
 * ritmo normal. Chamado pelo instrumentation no boot do servidor. */
export async function catchUp(): Promise<void> {
  const s = state()
  if (s.catchUpDone) return
  s.catchUpDone = true
  if (!(await hasPendingWork().catch(() => false))) {
    lastTickResult = { at: Date.now(), action: 'ociosa', detail: 'abertura sem pendências' }
    return
  }
  ensureQueueInterval()
  for (let i = 0; i < 5; i++) {
    await pollAutentique().catch(() => undefined)
    await pollAsaas().catch(() => undefined)
    await new Promise((r) => setTimeout(r, 1500))
  }
  lastTickResult = { at: Date.now(), action: 'captura', detail: 'varredura de abertura concluída' }
}
