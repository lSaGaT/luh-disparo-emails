import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth'
import { rateLimitHit } from '@/lib/rate-limit'

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')

  // brute force: 5 tentativas por IP+email a cada 15 minutos
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local'
  const rl = rateLimitHit(`login:${ip}:${email}`, MAX_ATTEMPTS, WINDOW_MS)
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${Math.ceil(rl.retryAfterSec / 60)} minuto(s).` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const user = await db.user.findUnique({ where: { email } })
  // bcrypt dummy quando o usuário não existe: mesma curva de tempo nas duas
  // respostas, para o timing não revelar quais e-mails estão cadastrados
  const hash = user?.passwordHash || '$2b$10$C6UzMDM.H6dfI/f/IKcEeO7ZUbE0f8bZGm1xRwZ1b8Yq7VXpQ1SKe'
  const passwordOk = await bcrypt.compare(password, hash)
  if (!user || !password || !passwordOk) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 })
  }

  const token = await createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    tokenVersion: user.tokenVersion,
  })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request.headers.get('host')))
  res.headers.set('Cache-Control', 'no-store')
  return res
}
