import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { getAppUrl } from '@/lib/settings'

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const { id } = await ctx.params
  const r = await db.recipient.findUnique({ where: { id } })
  if (!r) return NextResponse.json({ error: 'Destinatário não encontrado' }, { status: 404 })

  const base = await getAppUrl()
  return NextResponse.json({
    formUrl: `${base}/f/${r.token}`,
    statusPageUrl: `${base}/p/${r.token}`,
    signUrl: r.signUrl,
    paymentUrl: r.paymentUrl,
  })
}
