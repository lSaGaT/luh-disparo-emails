import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, type SessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureQueueInterval } from '@/lib/queue'

/**
 * Defesa CSRF para rotas mutantes. O cookie de sessão usa SameSite=None
 * (requisito do painel em iframe), então o gate no servidor é obrigatório:
 * - Origin presente e de host diferente → rejeita (form forjado cross-site);
 * - Origin ausente mas Sec-Fetch-Site indica cross-site → rejeita;
 * - clientes sem esses headers (curl, integrações) passam — não são CSRF-áveis;
 * - body JSON é exigido nos métodos de escrita (form HTML envia text/plain).
 */
function csrfCheck(request: NextRequest): string | null {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return null

  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin) {
    try {
      if (new URL(origin).host !== host) return 'Origin de outra origem'
    } catch {
      return 'Origin inválido'
    }
  } else {
    const site = request.headers.get('sec-fetch-site')
    if (site && !['same-origin', 'same-site', 'none'].includes(site)) {
      return 'Request cross-site sem Origin'
    }
    const contentType = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (contentType && contentType !== 'application/json') {
      return 'Content-Type não permitido'
    }
  }
  return null
}

/**
 * Gate de autorização das rotas admin (verdadeiro controle — o middleware é
 * só uma primeira barreira). Revalida a sessão contra o banco:
 * - o usuário ainda existe (token não sobrevive à exclusão da conta);
 * - a tokenVersion do JWT confere com a atual (troca de senha revoga tokens);
 * - os claims (email/name) vêm do banco, não do token (sem claims obsoletos).
 */
export async function requireSession(request?: NextRequest): Promise<{ user: SessionUser } | { response: NextResponse }> {
  if (request) {
    const csrfError = csrfCheck(request)
    if (csrfError) {
      return { response: NextResponse.json({ error: csrfError }, { status: 403 }) }
    }
  }

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
