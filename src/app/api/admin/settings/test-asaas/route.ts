import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getSettings } from '@/lib/settings'
import * as asaas from '@/lib/asaas'

export async function POST(request: NextRequest) {
  const auth = await requireSession(request)
  if ('response' in auth) return auth.response

  const s = await getSettings()
  if (!s.asaasApiKey) {
    return NextResponse.json({ ok: false, error: 'API key do Asaas não configurada.' }, { status: 400 })
  }
  try {
    await asaas.testApiKey()
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 })
  }
}
