import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'sessao_admin'

export type SessionUser = {
  id: string
  email: string
  name: string
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || 'dev-secret-insecure-change-me'
  return new TextEncoder().encode(secret)
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return await new SignJWT({ email: user.email, name: user.name })
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
