import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'sessao_admin'

export type SessionUser = {
  id: string
  email: string
  name: string
  /** tokenVersion no momento da emissão — checado contra o User no requireSession */
  tokenVersion?: number
}

/** Opções do cookie de sessão adaptadas ao contexto de acesso.
 *
 * Quando o painel é acessado por um domínio real (ex.: link de preview, servido
 * dentro de um iframe de outro domínio), o navegador só aceita/guarda o cookie
 * se ele for `SameSite=None; Secure; Partitioned` — com `SameSite=Lax` o cookie
 * é descartado em contexto cross-site e o usuário volta para o login em loop.
 * Em localhost/IP (acesso HTTP direto) mantemos `Lax`, que funciona normalmente.
 * ATENÇÃO: a branch de IP assume HTTP — em produção o edge (Caddy/nginx) deve
 * terminar TLS; o cookie de sessão nunca deve trafegar em texto claro na internet.
 */
export function sessionCookieOptions(hostHeader: string | null): {
  httpOnly: boolean
  sameSite: 'lax' | 'none'
  secure: boolean
  partitioned: boolean
  maxAge: number
  path: string
} {
  const host = (hostHeader || '').toLowerCase().split(':')[0]
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    // loopback/privado em notação IPv4 válida (octetos 0-255)
    /^(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(
      host
    )

  if (isLocal) {
    return { httpOnly: true, sameSite: 'lax', secure: false, partitioned: false, maxAge: 7 * 86400, path: '/' }
  }
  // Domínio real: sempre servido por HTTPS (gateway/proxy), precisa cross-site.
  return { httpOnly: true, sameSite: 'none', secure: true, partitioned: true, maxAge: 7 * 86400, path: '/' }
}

function getSecret(): Uint8Array {
  // Sem fallback: um segredo default conhecido permitiria forjar sessão admin.
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET ausente ou fraca: defina uma segredo de ao menos 32 caracteres no ambiente.')
  }
  return new TextEncoder().encode(secret)
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return await new SignJWT({ email: user.email, name: user.name, ver: user.tokenVersion ?? 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (!payload.sub) return null
    return {
      id: payload.sub,
      email: (payload.email as string) || '',
      name: (payload.name as string) || '',
      tokenVersion: typeof payload.ver === 'number' ? payload.ver : undefined,
    }
  } catch {
    return null
  }
}

/** Lê a sessão do cookie (server components / route handlers). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}
