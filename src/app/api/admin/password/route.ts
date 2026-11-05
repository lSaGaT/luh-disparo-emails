import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { requireSession } from '@/lib/api-auth'
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth'
import { rateLimitHit } from '@/lib/rate-limit'

const MIN_PASSWORD = 10
const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000

/** Altera a senha do administrador logado. */
export async function POST(request: NextRequest) {
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local'
  const rl = rateLimitHit(`password:${ip}:${auth.user.id}`, MAX_ATTEMPTS, WINDOW_MS)
  if (rl.blocked) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const currentPassword = String(body?.currentPassword || '')
  const newPassword = String(body?.newPassword || '')

  if (newPassword.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `A nova senha precisa ter ao menos ${MIN_PASSWORD} caracteres.` }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { id: auth.user.id } })
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  // tokenVersion++ revoga todos os JWT emitidos antes (inclui sessões roubadas);
  // reemitimos o cookie para a sessão atual continuar válida
  const updated = await db.user.update({
    where: { id: user.id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  })

  const token = await createSessionToken({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    tokenVersion: updated.tokenVersion,
  })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request.headers.get('host')))
  res.headers.set('Cache-Control', 'no-store')
  return res
}
