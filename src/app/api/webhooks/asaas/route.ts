import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stepMarkPaid } from '@/lib/pipeline'
import * as asaas from '@/lib/asaas'
import crypto from 'crypto'

/**
 * Webhook do Asaas — registra e processa eventos de pagamento.
 *
 * Segurança (em camadas):
 * 1. Se ASAAS_WEBHOOK_SECRET estiver definido, exige o header `asaas-signature`
 *    (HMAC-SHA256 do body cru, como o Asaas envia). Rejeita 401 SEM gravar log.
 * 2. Mesmo com assinatura válida, nenhum payload é fonte de verdade: antes de
 *    marcar como pago, o status real é reconfirmado na API do Asaas
 *    (mesmo padrão do webhook da Autentique e do poller).
 */

const PAID_EVENTS = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']
const REFUND_EVENTS = ['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_FAILED']

function signatureValid(raw: string, signature: string | null): boolean {
  const secret = process.env.ASAAS_WEBHOOK_SECRET
  if (!secret) return true // sem segredo configurado: a reconfirmação via API é a garantia
  if (!signature) return false
  const digest = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  const provided = signature.replace(/^sha256=/, '')
  const a = Buffer.from(digest)
  const b = Buffer.from(provided)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  const raw = await request.text()

  if (!signatureValid(raw, request.headers.get('asaas-signature'))) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }

  let payload: Record<string, unknown> | null = null
  try {
    payload = JSON.parse(raw)
  } catch {
    payload = null
  }

  const event = (payload?.event || payload?.eventName || '') as string
  const payment = (payload?.payment || {}) as Record<string, unknown>
  const paymentId = String(payment.id || '')
  const externalRef = String(payment.externalReference || '')

  const log = await db.webhookLog.create({
    data: {
      source: 'asaas',
      body: raw.slice(0, 1000),
      handled: false,
      note: `${event || 'evento sem tipo'} payment=${paymentId || '?'}`,
    },
  })

  const isPaidEvent = PAID_EVENTS.includes(event) && (!!paymentId || !!externalRef)
  const isRefundEvent = REFUND_EVENTS.includes(event) && (!!paymentId || !!externalRef)
  if (!isPaidEvent && !isRefundEvent) {
    return NextResponse.json({ ok: true })
  }

  const recipient = await db.recipient.findFirst({
    where: paymentId
      ? { asaasPaymentId: paymentId }
      : { id: externalRef, status: 'pagamento_enviado' },
  })
  if (!recipient) {
    await db.webhookLog.update({ where: { id: log.id }, data: { note: `${log.note} | recipient não encontrado` } })
    return NextResponse.json({ ok: true })
  }

  // ---- reembolso/chargeback: reabre a cobrança (o estado 'pago' não é eterno) ----
  if (isRefundEvent) {
    if (recipient.status === 'pago') {
      await db.recipient.update({
        where: { id: recipient.id },
        data: { status: 'pagamento_enviado', paidAt: null },
      })
      await db.webhookLog.update({
        where: { id: log.id },
        data: { handled: true, note: `${log.note} | pago → pagamento_enviado (reembolso/chargeback)` },
      })
    }
    return NextResponse.json({ ok: true })
  }

  // ---- pagamento: confirma somente se a API do Asaas disser que está pago ----
  const idToCheck = paymentId || recipient.asaasPaymentId
  if (!idToCheck) {
    await db.webhookLog.update({ where: { id: log.id }, data: { note: `${log.note} | sem paymentId para reconfirmar` } })
    return NextResponse.json({ ok: true })
  }

  try {
    const real = await asaas.getPayment(idToCheck)
    if (asaas.isPaidStatus(real.status)) {
      if (recipient.status === 'pagamento_enviado') {
        await stepMarkPaid(recipient.id)
      }
      await db.webhookLog.update({
        where: { id: log.id },
        data: { handled: true, note: `${log.note} | confirmado na API (status ${real.status})` },
      })
    } else {
      await db.webhookLog.update({
        where: { id: log.id },
        data: { note: `${log.note} | API do Asaas informa status ${real.status} — não marcado como pago` },
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.webhookLog.update({
      where: { id: log.id },
      data: { note: `${log.note} | falha ao reconfirmar na API: ${msg.slice(0, 200)}` },
    })
  }

  return NextResponse.json({ ok: true })
}
