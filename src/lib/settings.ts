import { db } from '@/lib/db'
import { DEFAULT_CONTRACT_TEMPLATE } from '@/lib/fields'

export type AppSettings = {
  smtpHost: string
  smtpPort: number
  smtpUser: string | null
  smtpPass: string | null
  smtpFromName: string
  autentiqueToken: string | null
  adminSignerName: string | null
  adminSignerEmail: string | null
  adminSignerCpf: string | null
  asaasApiKey: string | null
  asaasEnv: string
  appUrl: string | null
  queueDelaySeconds: number
  pollMinutes: number
  contractTemplate: string
}

export async function getSettings(): Promise<AppSettings> {
  let s = await db.settings.findUnique({ where: { id: 'singleton' } })
  if (!s) {
    s = await db.settings.create({ data: { id: 'singleton' } })
  }
  return {
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpUser: s.smtpUser,
    smtpPass: s.smtpPass,
    smtpFromName: s.smtpFromName,
    autentiqueToken: s.autentiqueToken,
    adminSignerName: s.adminSignerName,
    adminSignerEmail: s.adminSignerEmail,
    adminSignerCpf: s.adminSignerCpf,
    asaasApiKey: s.asaasApiKey,
    asaasEnv: s.asaasEnv,
    appUrl: s.appUrl,
    queueDelaySeconds: s.queueDelaySeconds,
    pollMinutes: s.pollMinutes,
    contractTemplate: s.contractTemplate || DEFAULT_CONTRACT_TEMPLATE,
  }
}

export async function updateSettings(data: Partial<AppSettings>): Promise<void> {
  await db.settings.upsert({
    where: { id: 'singleton' },
    update: {
      ...data,
      // nunca apagar o modelo salvando vazio
      contractTemplate: data.contractTemplate === undefined ? undefined : data.contractTemplate || null,
    },
    create: { id: 'singleton', ...data },
  })
}

/**
 * URL base pública usada nos links enviados por e-mail.
 *
 * Segurança: um appUrl malicioso faz TODOS os e-mails oficiais apontarem os
 * botões para um domínio do atacante (BEC com remetente legítimo). Regras:
 * - exige https://, exceto localhost/127.0.0.1 (ambiente de teste);
 * - se APP_URL_ALLOWLIST estiver definida (separada por vírgula), o host
 *   precisa estar nela.
 */
export async function getAppUrl(): Promise<string> {
  const s = await getSettings()
  const candidate = s.appUrl?.trim()
  if (candidate && isValidAppUrl(candidate)) return candidate.replace(/\/$/, '')
  // fallback: URL de preview do sandbox
  const preview = process.env.PREVIEW_URL
  if (preview && isValidAppUrl(preview)) return preview.replace(/\/$/, '')
  return 'http://localhost:3000'
}

export function isValidAppUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const host = parsed.hostname.toLowerCase()
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  if (!isLocal && parsed.protocol !== 'https:') return false
  const allowlist = (process.env.APP_URL_ALLOWLIST || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
  if (allowlist.length > 0 && !allowlist.includes(host)) return false
  return true
}
