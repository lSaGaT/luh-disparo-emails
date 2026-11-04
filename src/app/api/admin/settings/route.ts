import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getSettings, updateSettings, type AppSettings } from '@/lib/settings'

export async function GET() {
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  return NextResponse.json({ settings: await getSettings() })
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
    } else {
      const v = String(body[key] ?? '')
      ;(data as Record<string, unknown>)[key] = v.trim() || null
    }
  }

  await updateSettings(data)
  return NextResponse.json({ ok: true, settings: await getSettings() })
}
