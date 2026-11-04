import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stepMarkPaid } from '@/lib/pipeline'

/**
 * Webhook do Asaas — registra e processa eventos de pagamento.
 * Configure a URL no painel do Asaas (webhooks), eventos de cobrança.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text()
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

  await db.webhookLog.create({
    data: {
      source: 'asaas',
      body: raw.slice(0, 4000),
      handled: false,
      note: `${event || 'evento sem tipo'} payment=${paymentId || '?'}`,
    },
  })

  const paidEvents = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']
  if (!paidEvents.includes(event) || (!paymentId && !externalRef)) {
    return NextResponse.json({ ok: true })
  }

  const recipient = await db.recipient.findFirst({
    where: paymentId
      ? { asaasPaymentId: paymentId }
      : { id: externalRef, status: 'pagamento_enviado' },
  })
  if (!recipient) return NextResponse.json({ ok: true })

  if (recipient.status === 'pagamento_enviado') {
    await stepMarkPaid(recipient.id)
  }

  return NextResponse.json({ ok: true })
}
