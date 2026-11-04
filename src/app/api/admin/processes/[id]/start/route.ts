import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { ensureQueueInterval } from '@/lib/queue'

export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const { id } = await ctx.params
  await db.process.update({ where: { id }, data: { status: 'disparando' } })
  ensureQueueInterval()
  return NextResponse.json({ ok: true })
}
