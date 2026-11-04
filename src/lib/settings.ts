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

/** URL base pública usada nos links enviados por e-mail. */
export async function getAppUrl(): Promise<string> {
  const s = await getSettings()
  if (s.appUrl && s.appUrl.startsWith('http')) return s.appUrl.replace(/\/$/, '')
  // fallback: URL de preview do sandbox
  const preview = process.env.PREVIEW_URL
  if (preview) return preview.replace(/\/$/, '')
  return 'http://localhost:3000'
}
