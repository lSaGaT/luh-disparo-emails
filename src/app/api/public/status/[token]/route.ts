import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fieldDef } from '@/lib/fields'
import { isLinkExpired } from '@/lib/public-token'

/** Página de status e segunda via (vista da pessoa). */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const r = await db.recipient.findUnique({ where: { token }, include: { process: true } })
  if (!r || isLinkExpired(r)) return NextResponse.json({ error: 'Link inválido.' }, { status: 404 })

  let formData: Record<string, string> = {}
  try {
    formData = JSON.parse(r.formData || '{}')
  } catch {
    formData = {}
  }

  return NextResponse.json({
    name: r.name,
    processName: r.process.name,
    referenceDate: r.process.referenceDate,
    status: r.status,
    error: r.stage ? r.error : null,
    email: r.email,
    submittedAt: r.submittedAt,
    contractSentAt: r.contractSentAt,
    signedAt: r.signedAt,
    paymentSentAt: r.paymentSentAt,
    paidAt: r.paidAt,
    signUrl: r.signUrl,
    paymentUrl: r.paymentUrl,
    hasSignedPdf: !!r.signedPdfB64,
    adminSigned: r.adminSigned,
    formFields: Object.entries(formData)
      .filter(([k]) => fieldDef(k))
      .map(([k, v]) => ({ label: fieldDef(k)?.label || k, value: v })),
  })
}
