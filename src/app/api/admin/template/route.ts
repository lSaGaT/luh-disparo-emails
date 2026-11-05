import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getSettings, updateSettings } from '@/lib/settings'

export async function GET() {
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const s = await getSettings()
  return NextResponse.json({ template: s.contractTemplate })
}

export async function PUT(request: NextRequest) {
  const auth = await requireSession(request)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  const template = String(body?.template || '').trim()
  if (!template) {
    return NextResponse.json({ error: 'O modelo não pode ficar vazio.' }, { status: 400 })
  }
  await updateSettings({ contractTemplate: template })
  return NextResponse.json({ ok: true })
}
