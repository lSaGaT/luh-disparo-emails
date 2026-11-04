import { NextResponse } from 'next/server'
import { getSessionUser, type SessionUser } from '@/lib/auth'
import { ensureQueueInterval } from '@/lib/queue'

export async function requireSession(): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getSessionUser()
  if (!user) {
    return { response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }
  ensureQueueInterval()
  return { user }
}
