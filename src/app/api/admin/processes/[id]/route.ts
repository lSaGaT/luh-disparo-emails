import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { parseFields } from '@/lib/fields'
import { getAppUrl } from '@/lib/settings'

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const { id } = await ctx.params
  const process = await db.process.findUnique({
    where: { id },
    include: { recipients: { orderBy: { createdAt: 'asc' } } },
  })
  if (!process) return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })

  const base = await getAppUrl()
  return NextResponse.json({
    process: {
      id: process.id,
      name: process.name,
      referenceDate: process.referenceDate,
      amount: process.amount,
      dueDate: process.dueDate,
      description: process.description,
      status: process.status,
      formFields: parseFields(process.formFields),
      createdAt: process.createdAt,
    },
    base,
    recipients: process.recipients.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      token: r.token,
      status: r.status,
      stage: r.stage,
      error: r.error,
      submittedAt: r.submittedAt,
      signUrl: r.signUrl,
      paymentUrl: r.paymentUrl,
      signedAt: r.signedAt,
      paidAt: r.paidAt,
      adminSigned: r.adminSigned,
      hasSignedPdf: !!r.signedPdfB64,
      formUrl: `${base}/f/${r.token}`,
      statusPageUrl: `${base}/p/${r.token}`,
    })),
  })
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(request)
  if ('response' in auth) return auth.response

  const { id } = await ctx.params
  await db.process.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
