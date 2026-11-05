import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { emailTest } from '@/lib/mailer'

export async function POST(request: NextRequest) {
  const auth = await requireSession(request)
  if ('response' in auth) return auth.response

  const body = await request.json().catch(() => null)
  const to = String(body?.to || '').trim()
  if (!/.+@.+\..+/.test(to)) {
    return NextResponse.json({ ok: false, error: 'Informe um e-mail válido.' }, { status: 400 })
  }
  const result = await emailTest(to)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
