import { NextResponse } from 'next/server'
import { getSessionUser, type SessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureQueueInterval } from '@/lib/queue'

/**
 * Gate de autorização das rotas admin (verdadeiro controle — o middleware é
 * só uma primeira barreira). Revalida a sessão contra o banco:
 * - o usuário ainda existe (token não sobrevive à exclusão da conta);
 * - a tokenVersion do JWT confere com a atual (troca de senha revoga tokens);
 * - os claims (email/name) vêm do banco, não do token (sem claims obsoletos).
 */
export async function requireSession(): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const session = await getSessionUser()
  if (!session) {
    return { response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }

  const user = await db.user.findUnique({ where: { id: session.id } })
  if (!user || user.tokenVersion !== (session.tokenVersion ?? 0)) {
    return { response: NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 }) }
  }

  ensureQueueInterval()
  return { user: { id: user.id, email: user.email, name: user.name, tokenVersion: user.tokenVersion } }
}
