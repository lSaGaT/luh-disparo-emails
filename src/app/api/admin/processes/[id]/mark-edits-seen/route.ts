import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'

/** Marca os alertas de edição deste processo como vistos pelo admin. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(request)
  if ('response' in auth) return auth.response

  const { id } = await ctx.params
  const now = new Date()
  await db.recipient.updateMany({
    where: { processId: id, editedAt: { not: null }, OR: [{ editSeenAt: null }, { editSeenAt: { lt: db.recipient.fields.editedAt } }] },
    data: { editSeenAt: now },
  })
  return NextResponse.json({ ok: true })
}
