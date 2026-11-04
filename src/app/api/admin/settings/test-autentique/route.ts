import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getSettings } from '@/lib/settings'
import { testToken } from '@/lib/autentique'

export async function POST() {
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const s = await getSettings()
  if (!s.autentiqueToken) {
    return NextResponse.json({ ok: false, error: 'Token da Autentique não configurado.' }, { status: 400 })
  }
  try {
    await testToken(s.autentiqueToken)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 })
  }
}
