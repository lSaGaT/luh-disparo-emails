import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { emailFormLink, emailSignLink, emailPaymentLink } from '@/lib/mailer'
import { resendSignedCopy, retryRecipient } from '@/lib/pipeline'

type Kind = 'form' | 'contract' | 'payment' | 'copy'

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(request)
  if ('response' in auth) return auth.response

  const { id } = await ctx.params
  const body = await request.json().catch(() => null)
  const kind = String(body?.kind || '') as Kind

  const r = await db.recipient.findUnique({ where: { id }, include: { process: true } })
  if (!r) return NextResponse.json({ error: 'Destinatário não encontrado' }, { status: 404 })

  let result: { ok: boolean; error?: string } = { ok: false, error: 'Ação inválida' }

  if (kind === 'form') {
    result = await emailFormLink({
      name: r.name,
      email: r.email,
      token: r.token,
      processName: r.process.name,
    })
  } else if (kind === 'contract') {
    if (!r.signUrl) {
      result = { ok: false, error: 'Link de assinatura ainda não gerado' }
    } else {
      result = await emailSignLink({ name: r.name, email: r.email, signUrl: r.signUrl, processName: r.process.name })
    }
  } else if (kind === 'payment') {
    if (!r.paymentUrl) {
      result = { ok: false, error: 'Link de pagamento ainda não gerado' }
    } else {
      result = await emailPaymentLink({
        name: r.name,
        email: r.email,
        paymentUrl: r.paymentUrl,
        processName: r.process.name,
        amount: r.process.amount,
        dueDate: r.process.dueDate,
      })
    }
  } else if (kind === 'copy') {
    result = await resendSignedCopy(r.id)
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
