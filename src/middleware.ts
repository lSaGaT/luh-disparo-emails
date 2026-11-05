import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const user = token ? await verifySessionToken(token) : null

  if (!user) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      const res = NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
      // Sem no-store o navegador pode guardar esse 401 e responder as
      // próximas chamadas direto do cache — o painel volta ao login em
      // loop mesmo com a sessão válida.
      res.headers.set('Cache-Control', 'no-store')
      return res
    }
    // Location relativo: não reflete o header Host (host header injection)
    const res = new NextResponse(null, { status: 307, headers: { Location: '/login' } })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }

  const res = NextResponse.next()
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export const config = {
  matcher: [
    '/processos',
    '/processos/:path*',
    '/modelo',
    '/modelo/:path*',
    '/configuracoes',
    '/configuracoes/:path*',
    '/api/admin/:path*',
  ],
}
