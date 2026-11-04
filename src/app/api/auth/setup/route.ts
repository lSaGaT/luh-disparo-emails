import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth'

/** Cria o primeiro acesso do administrador (só funciona se não houver usuário). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const name = String(body?.name || '').trim()
  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')

  if (!name || !email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: 'Informe nome e e-mail válidos.' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'A senha precisa ter ao menos 6 caracteres.' }, { status: 400 })
  }

  const existingUsers = await db.user.count()
  if (existingUsers > 0) {
    return NextResponse.json({ error: 'O acesso administrador já foi criado. Faça login.' }, { status: 403 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await db.user.create({ data: { name, email, passwordHash } })

  const token = await createSessionToken({ id: user.id, email: user.email, name: user.name })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request.headers.get('host')))
  res.headers.set('Cache-Control', 'no-store')
  return res
}
