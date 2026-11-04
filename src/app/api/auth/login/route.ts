import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')

  const user = await db.user.findUnique({ where: { email } })
  if (!user || !password || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 })
  }

  const token = await createSessionToken({ id: user.id, email: user.email, name: user.name })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request.headers.get('host')))
  res.headers.set('Cache-Control', 'no-store')
  return res
}
