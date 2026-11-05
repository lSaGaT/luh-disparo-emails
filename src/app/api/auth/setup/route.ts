import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth'

const MIN_PASSWORD = 10

/** Cria o primeiro acesso do administrador (só funciona se não houver usuário). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const name = String(body?.name || '').trim()
  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')

  if (!name || !email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: 'Informe nome e e-mail válidos.' }, { status: 400 })
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.` }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  // transação: o SQLite serializa, então a checagem+criatura é atômica —
  // requests concorrentes não conseguem criar dois administradores
  try {
    const user = await db.$transaction(async (tx) => {
      const existing = await tx.user.count()
      if (existing > 0) return null
      return tx.user.create({ data: { name, email, passwordHash } })
    })

    if (!user) {
      return NextResponse.json({ error: 'O acesso administrador já foi criado. Faça login.' }, { status: 403 })
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
  } catch {
    return NextResponse.json({ error: 'Não foi possível criar o acesso. Tente novamente.' }, { status: 500 })
  }
}
