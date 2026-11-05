import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseFields, ALL_FIELDS, fieldDef } from '@/lib/fields'
import { isValidCpf } from '@/lib/format'
import { onFormSubmitted } from '@/lib/pipeline'
import { isLinkExpired } from '@/lib/public-token'

const MAX_BODY_BYTES = 64 * 1024
const MAX_FIELD_LENGTH = 200

async function getRecipient(token: string) {
  return db.recipient.findUnique({ where: { token }, include: { process: true } })
}

/** Dados do formulário para a pessoa preencher. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const r = await getRecipient(token)
  if (!r || isLinkExpired(r)) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })

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
  if (!r || isLinkExpired(r)) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })

  // ---- claim atômico ANTES de ler o body (fecha o TOCTOU): duas submissões
  // concorrentes nunca passam as duas; quem perder recebe 409.
  const claim = await db.recipient.updateMany({
    where: { id: r.id, status: { in: ['fila', 'form_enviado', 'erro'] } },
    data: { status: 'form_recebido' },
  })
  if (claim.count !== 1) {
    return NextResponse.json({ error: 'Este formulário já foi enviado.' }, { status: 409 })
  }

  const restoreStatus = () =>
    db.recipient.update({ where: { id: r.id }, data: { status: r.status } })

  // ---- body com limite de tamanho (DoS de armazenamento/PDF) ----
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    await restoreStatus()
    return NextResponse.json({ error: 'Payload muito grande.' }, { status: 413 })
  }
  const body = (() => {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })()
  if (!body || typeof body !== 'object') {
    await restoreStatus()
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }
  const input = (body.data || {}) as Record<string, unknown>

  const enabledKeys = parseFields(r.process.formFields)
  const data: Record<string, string> = { email: r.email }

  for (const key of enabledKeys) {
    const def = fieldDef(key)
    if (!def) continue
    if (key === 'email') continue // e-mail já é conhecido
    // cap por campo + quebras de linha viram espaço: o valor vai para o corpo
    // do contrato PDF — \n permitia injetar cláusulas no documento assinado
    const value = String(input[key] ?? '')
      .replace(/\s*\r?\n+\s*/g, ' ')
      .trim()
      .slice(0, MAX_FIELD_LENGTH)
    if (!value) {
      await restoreStatus()
      return NextResponse.json({ error: `Preencha o campo "${def.label}".` }, { status: 400 })
    }
    data[key] = value
  }

  if (data.cpf && !isValidCpf(data.cpf)) {
    await restoreStatus()
    return NextResponse.json({ error: 'CPF inválido. Confira os números digitados.' }, { status: 400 })
  }

  await db.recipient.update({
    where: { id: r.id },
    data: { formData: JSON.stringify(data) },
  })

  await onFormSubmitted(r.id)

  return NextResponse.json({ ok: true })
}
