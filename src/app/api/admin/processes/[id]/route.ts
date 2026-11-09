import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { parseFields, ALL_FIELDS } from '@/lib/fields'
import { getAppUrl } from '@/lib/settings'

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const { id } = await ctx.params
  const process = await db.process.findUnique({
    where: { id },
    include: { recipients: { orderBy: { createdAt: 'asc' } } },
  })
  if (!process) return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })

  const base = await getAppUrl()
  return NextResponse.json({
    process: {
      id: process.id,
      name: process.name,
      referenceDate: process.referenceDate,
      amount: process.amount,
      dueDate: process.dueDate,
      description: process.description,
      status: process.status,
      formFields: parseFields(process.formFields),
      createdAt: process.createdAt,
    },
    base,
    recipients: process.recipients.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      token: r.token,
      status: r.status,
      stage: r.stage,
      error: r.error,
      submittedAt: r.submittedAt,
      editedAt: r.editedAt,
      editSeenAt: r.editSeenAt,
      signUrl: r.signUrl,
      paymentUrl: r.paymentUrl,
      signedAt: r.signedAt,
      paidAt: r.paidAt,
      adminSigned: r.adminSigned,
      hasSignedPdf: !!r.signedPdfB64,
      formUrl: `${base}/f/${r.token}`,
      statusPageUrl: `${base}/p/${r.token}`,
    })),
  })
}

/** Edita os dados do processo. Campos do formulário também podem mudar —
 * quem já enviou mantém os dados antigos; novos formulários usam a lista nova. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(request)
  if ('response' in auth) return auth.response

  const { id } = await ctx.params
  const existing = await db.process.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })

  const data: {
    name?: string
    referenceDate?: string
    amount?: number | null
    dueDate?: string | null
    description?: string | null
    formFields?: string
  } = {}

  if (body.name !== undefined) {
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'Informe o nome do processo.' }, { status: 400 })
    if (name.length > 200) return NextResponse.json({ error: 'Nome do processo muito longo (máx. 200 caracteres).' }, { status: 400 })
    data.name = name
  }
  if (body.referenceDate !== undefined) {
    const referenceDate = String(body.referenceDate || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
      return NextResponse.json({ error: 'Data de referência inválida.' }, { status: 400 })
    }
    data.referenceDate = referenceDate
  }
  if (body.amount !== undefined) {
    if (body.amount === null || body.amount === '') {
      data.amount = null
    } else {
      const amount = Number(body.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 })
      }
      data.amount = amount
    }
  }
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? String(body.dueDate) : null
  if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null
  if (body.formFields !== undefined) {
    if (!Array.isArray(body.formFields)) return NextResponse.json({ error: 'Lista de campos inválida.' }, { status: 400 })
    const validKeys = new Set<string>(ALL_FIELDS.map((f) => f.key))
    const required = new Set(ALL_FIELDS.filter((f) => f.alwaysOn).map((f) => f.key))
    const picked = body.formFields.filter((k: unknown) => typeof k === 'string' && validKeys.has(k as string))
    for (const k of required) if (!picked.includes(k)) picked.push(k)
    data.formFields = JSON.stringify(picked)
  }

  await db.process.update({ where: { id }, data })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(request)
  if ('response' in auth) return auth.response

  const { id } = await ctx.params
  await db.process.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
