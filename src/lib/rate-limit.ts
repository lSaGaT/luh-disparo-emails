/**
 * Rate limit em memória (app single-node com SQLite).
 * Janela deslizante simples por chave (ex.: "ip:email").
 * Não substitui um limitador distribuído — se migrar para multi-instância,
 * trocar por Redis/Upstash.
 */

type Bucket = { hits: number[] }

const globalForRateLimit = globalThis as unknown as {
  __rateLimitBuckets?: Map<string, Bucket>
}

function buckets(): Map<string, Bucket> {
  if (!globalForRateLimit.__rateLimitBuckets) {
    globalForRateLimit.__rateLimitBuckets = new Map()
  }
  return globalForRateLimit.__rateLimitBuckets
}

/** Registra uma tentativa. Retorna quantas tentativas restam antes do bloqueio. */
export function rateLimitHit(key: string, limit: number, windowMs: number): { blocked: boolean; retryAfterSec: number } {
  const map = buckets()
  const now = Date.now()
  const b = map.get(key) || { hits: [] }
  b.hits = b.hits.filter((t) => now - t < windowMs)
  b.hits.push(now)
  map.set(key, b)

  if (b.hits.length > limit) {
    const oldest = b.hits[0]
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000))
    return { blocked: true, retryAfterSec }
  }
  return { blocked: false, retryAfterSec: 0 }
}

/** Consulta sem registrar. */
export function rateLimitBlocked(key: string, limit: number, windowMs: number): boolean {
  const b = buckets().get(key)
  if (!b) return false
  const now = Date.now()
  return b.hits.filter((t) => now - t < windowMs).length >= limit
}
