import { NextRequest, NextResponse } from 'next/server'
import { sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const res = NextResponse.json({ ok: true })
  // Espelha os mesmos atributos do cookie original para que o navegador
  // remova a entrada correta (inclusive a versão Partitioned do preview).
  const opts = sessionCookieOptions(request.headers.get('host'))
  res.cookies.set(SESSION_COOKIE, '', { ...opts, maxAge: 0 })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
