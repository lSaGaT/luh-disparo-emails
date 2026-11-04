import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { requireSession } from '@/lib/api-auth'

/** Altera a senha do administrador logado. */
export async function POST(request: NextRequest) {
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const body = await request.json().catch(() => null)
  const currentPassword = String(body?.currentPassword || '')
  const newPassword = String(body?.newPassword || '')

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'A nova senha precisa ter ao menos 6 caracteres.' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { id: auth.user.id } })
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await db.user.update({ where: { id: user.id }, data: { passwordHash } })
  return NextResponse.json({ ok: true })
}
