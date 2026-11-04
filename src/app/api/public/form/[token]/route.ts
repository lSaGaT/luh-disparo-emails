import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseFields, ALL_FIELDS, fieldDef } from '@/lib/fields'
import { isValidCpf } from '@/lib/format'
import { onFormSubmitted } from '@/lib/pipeline'

async function getRecipient(token: string) {
  return db.recipient.findUnique({ where: { token }, include: { process: true } })
}

/** Dados do formulário para a pessoa preencher. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const r = await getRecipient(token)
  if (!r) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })

  const enabledKeys = parseFields(r.process.formFields)
  const fields = ALL_FIELDS.filter((f) => enabledKeys.includes(f.key)).map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    placeholder: f.placeholder || '',
    mask: f.mask || null,
  }))

  return NextResponse.json({
    processName: r.process.name,
    referenceDate: r.process.referenceDate,
    recipientName: r.name,
    email: r.email,
    alreadySubmitted: r.status !== 'fila' && r.status !== 'form_enviado' && r.status !== 'erro',
    fields,
  })
}

/** Recebe o formulário preenchido. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const r = await getRecipient(token)
  if (!r) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })

  const alreadySubmitted = r.status !== 'fila' && r.status !== 'form_enviado' && r.status !== 'erro'
  if (alreadySubmitted) {
    return NextResponse.json({ error: 'Este formulário já foi enviado.' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const input = (body?.data || {}) as Record<string, string>

  const enabledKeys = parseFields(r.process.formFields)
  const data: Record<string, string> = { email: r.email }

  for (const key of enabledKeys) {
    const def = fieldDef(key)
    if (!def) continue
    if (key === 'email') continue // e-mail já é conhecido
    const value = String(input[key] || '').trim()
    if (!value) {
      return NextResponse.json({ error: `Preencha o campo "${def.label}".` }, { status: 400 })
    }
    data[key] = value
  }

  if (data.cpf && !isValidCpf(data.cpf)) {
    return NextResponse.json({ error: 'CPF inválido. Confira os números digitados.' }, { status: 400 })
  }

  await db.recipient.update({
    where: { id: r.id },
    data: { formData: JSON.stringify(data) },
  })

  await onFormSubmitted(r.id)

  return NextResponse.json({ ok: true })
}
