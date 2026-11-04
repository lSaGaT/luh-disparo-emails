import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { tick, ensureQueueInterval, getLastTick } from '@/lib/queue'

/** Processa um ciclo da fila (chamado periodicamente pelo painel). */
export async function POST() {
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  ensureQueueInterval()
  await tick()
  return NextResponse.json({ ok: true, lastTick: getLastTick() })
}
