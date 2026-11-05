import crypto from 'crypto'

/**
 * Credencial das rotas públicas (/f/[token], /p/[token], /api/public/*).
 *
 * - Gerada com CSPRNG (256 bits): o cuid() padrão do Prisma usa Math.random()
 *   + contador incremental e não é seguro como segredo.
 * - Expira TOKEN_TTL_DAYS dias após a criação do destinatário — o link que
 *   circula por e-mail não pode dar acesso a PII para sempre.
 */

export const TOKEN_TTL_DAYS = 90

export function generateRecipientToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function isLinkExpired(recipient: { createdAt: Date }): boolean {
  const ttlMs = TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  return Date.now() - recipient.createdAt.getTime() > ttlMs
}
