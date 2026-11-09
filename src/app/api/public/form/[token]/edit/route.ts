import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseFields, ALL_FIELDS, fieldDef } from '@/lib/fields'
import { isValidCpf } from '@/lib/format'
import { isLinkExpired } from '@/lib/public-token'
import { checkEditWindow, EDIT_WINDOW_DAYS } from '@/lib/edit-window'
import { rateLimitHit } from '@/lib/rate-limit'

const MAX_BODY_BYTES = 64 * 1024
const MAX_FIELD_LENGTH = 200

async function getRecipient(token: string) {
  return db.recipient.findUnique({ where: { token }, include: { process: true } })
}

/** Dados já enviados, para a pessoa corrigir pela página de acompanhamento. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const r = await getRecipient(token)
  if (!r || isLinkExpired(r)) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  if (!r.submittedAt || !r.formData) return NextResponse.json({ error: 'Formulário ainda não enviado.' }, { status: 404 })

  const window = checkEditWindow(r.process.referenceDate)
  const enabledKeys = parseFields(r.process.formFields)
  const saved = JSON.parse(r.formData) as Record<string, string>

  return NextResponse.json({
    processName: r.process.name,
    referenceDate: r.process.referenceDate,
    canEdit: window.allowed && r.status !== 'pago',
    daysLeft: window.daysLeft,
    editedAt: r.editedAt,
    fields: ALL_FIELDS.filter((f) => enabledKeys.includes(f.key)).map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      placeholder: f.placeholder || '',
      mask: f.mask || null,
      optional: f.optional === true,
    })),
    values: saved,
  })
}

/** Salva a correção. Não recria contrato/cobrança: o alerta aparece no painel
 * e o responsável decide o que fazer com documentos já gerados. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const r = await getRecipient(token)
  if (!r || isLinkExpired(r)) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  if (!r.submittedAt || !r.formData) return NextResponse.json({ error: 'Formulário ainda não enviado.' }, { status: 404 })
  if (r.status === 'pago') return NextResponse.json({ error: 'Processo já concluído — não é possível editar.' }, { status: 403 })

  const window = checkEditWindow(r.process.referenceDate)
  if (!window.allowed) {
    return NextResponse.json(
      {
        error:
          window.daysLeft <= 0
            ? 'A data do evento já passou — não é mais possível editar os dados.'
            : `As edições são permitidas somente até ${EDIT_WINDOW_DAYS} dias antes do evento. Faltam ${window.daysLeft} dia(s).`,
      },
      { status: 403 }
    )
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Payload muito grande.' }, { status: 413 })
  // spam de correção (token válido em mãos erradas): 20 salvamentos por minuto
  const rl = rateLimitHit(`edit:${token}`, 20, 60_000)
  if (rl.blocked) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })
  }
  const body = (() => {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })()
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  const input = (body.data || {}) as Record<string, unknown>

  // mesma validação do envio original: campos habilitados, caps, sem \n
  const enabledKeys = parseFields(r.process.formFields)
  const data: Record<string, string> = { email: r.email }
  for (const key of enabledKeys) {
    const def = fieldDef(key)
    if (!def || key === 'email') continue
    const value = String(input[key] ?? '')
      .replace(/\s*\r?\n+\s*/g, ' ')
      .trim()
      .slice(0, MAX_FIELD_LENGTH)
    if (!value && !def.optional) {
      return NextResponse.json({ error: `Preencha o campo "${def.label}".` }, { status: 400 })
    }
    if (value) data[key] = value
  }
  if (data.cpf && !isValidCpf(data.cpf)) {
    return NextResponse.json({ error: 'CPF inválido. Confira os números digitados.' }, { status: 400 })
  }

  await db.recipient.update({
    where: { id: r.id },
    data: { formData: JSON.stringify(data), editedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
