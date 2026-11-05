import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getSettings, updateSettings, isValidAppUrl, type AppSettings } from '@/lib/settings'

/** Valor devolvido no GET para segredos — nunca o valor real. */
const MASK = '••••••••'

function maskSettings(s: AppSettings): AppSettings {
  return {
    ...s,
    ...(s.smtpPass ? { smtpPass: MASK } : {}),
    ...(s.autentiqueToken ? { autentiqueToken: MASK } : {}),
    ...(s.asaasApiKey ? { asaasApiKey: MASK } : {}),
  }
}

export async function GET() {
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  // segredos não saem do servidor: o painel recebe máscara e só sobrescreve
  // quando o admin digita um valor novo
  return NextResponse.json({ settings: maskSettings(await getSettings()) })
}

export async function PUT(request: NextRequest) {
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const body = await request.json().catch(() => null)
  const allowed: (keyof AppSettings)[] = [
    'smtpHost',
    'smtpPort',
    'smtpUser',
    'smtpPass',
    'smtpFromName',
    'autentiqueToken',
    'adminSignerName',
    'adminSignerEmail',
    'adminSignerCpf',
    'asaasApiKey',
    'asaasEnv',
    'appUrl',
    'queueDelaySeconds',
    'pollMinutes',
    'contractTemplate',
  ]
  const data: Partial<AppSettings> = {}
  for (const key of allowed) {
    if (body?.[key] === undefined) continue
    if (key === 'smtpPort' || key === 'queueDelaySeconds' || key === 'pollMinutes') {
      const n = Number(body[key])
      if (Number.isFinite(n) && n > 0) (data as Record<string, unknown>)[key] = Math.floor(n)
    } else if (key === 'contractTemplate') {
      const v = String(body[key] || '')
      data.contractTemplate = v.trim() || undefined
    } else if (key === 'asaasEnv') {
      data.asaasEnv = body[key] === 'producao' ? 'producao' : 'sandbox'
    } else if (key === 'appUrl') {
      const v = String(body[key] ?? '').trim()
      if (v && !isValidAppUrl(v)) {
        return NextResponse.json(
          { error: 'URL inválida: use https:// (exceto localhost)' + (process.env.APP_URL_ALLOWLIST ? ' e um domínio da allowlist' : '') + '.' },
          { status: 400 }
        )
      }
      data.appUrl = v || null
    } else {
      const v = String(body[key] ?? '')
      // máscara recebida de volta = admin não alterou o segredo: manter atual
      if ((key === 'smtpPass' || key === 'autentiqueToken' || key === 'asaasApiKey') && v === MASK) continue
      ;(data as Record<string, unknown>)[key] = v.trim() || null
    }
  }

  await updateSettings(data)
  return NextResponse.json({ ok: true, settings: maskSettings(await getSettings()) })
}
