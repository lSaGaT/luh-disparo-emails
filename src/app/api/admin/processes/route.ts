import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'
import { parseFields, ALL_FIELDS } from '@/lib/fields'
import { generateRecipientToken } from '@/lib/public-token'

/** Lista simples de processos. */
export async function GET() {
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const processes = await db.process.findMany({
    orderBy: { createdAt: 'desc' },
    include: { recipients: { select: { status: true } } },
  })

  return NextResponse.json({
    processes: processes.map((p) => ({
      id: p.id,
      name: p.name,
      referenceDate: p.referenceDate,
      amount: p.amount,
      dueDate: p.dueDate,
      status: p.status,
      createdAt: p.createdAt,
      recipientCount: p.recipients.length,
      recipientStatuses: p.recipients.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1
        return acc
      }, {}),
    })),
  })
}

function parseEmailList(raw: string): { name: string; email: string }[] {
  const out: { name: string; email: string }[] = []
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim()
    if (!line) continue
    const parts = line.split(/[;\t]|,(?=\s*\S+@)/).map((p) => p.trim()).filter(Boolean)
    let name = ''
    let email = ''
    for (const part of parts) {
      if (/.+@.+\..+/.test(part) && !email) email = part
      else if (!name) name = part
    }
    if (!email) continue
    out.push({ name: name || email.split('@')[0], email: email.toLowerCase() })
  }
  return out
}

/** Cria um processo (envio em massa) com a lista de destinatários. */
export async function POST(request: NextRequest) {
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const body = await request.json().catch(() => null)
  const name = String(body?.name || '').trim()
  const referenceDate = String(body?.referenceDate || '').trim()
  const amount = body?.amount ? Number(body.amount) : null
  const dueDate = body?.dueDate ? String(body.dueDate) : null
  const description = body?.description ? String(body.description).trim() : null
  const emailsRaw = String(body?.emails || '')
  const formFieldsRaw = Array.isArray(body?.formFields) ? (body.formFields as string[]) : null

  if (!name) return NextResponse.json({ error: 'Informe o nome do processo.' }, { status: 400 })
  if (!referenceDate) return NextResponse.json({ error: 'Informe a data de referência.' }, { status: 400 })
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
    return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 })
  }

  const emails = parseEmailList(emailsRaw)
  if (emails.length === 0) {
    return NextResponse.json({ error: 'Informe ao menos um e-mail válido (um por linha).' }, { status: 400 })
  }
  if (emails.length > 5000) {
    return NextResponse.json({ error: 'Máximo de 5000 destinatários por processo.' }, { status: 400 })
  }
  if (name.length > 200) {
    return NextResponse.json({ error: 'Nome do processo muito longo (máx. 200 caracteres).' }, { status: 400 })
  }

  // valida chaves de campos
  const validKeys = new Set(ALL_FIELDS.map((f) => f.key))
  const formFields = (formFieldsRaw ? formFieldsRaw.filter((k) => validKeys.has(k)) : null) || null

  const process = await db.process.create({
    data: {
      name,
      referenceDate,
      amount,
      dueDate,
      description,
      formFields: formFields ? JSON.stringify(formFields) : JSON.stringify(parseFields(null)),
      recipients: {
        // token gerado com CSPRNG (o cuid default não é seguro como credencial)
        create: emails.map((e) => ({ name: e.name, email: e.email, token: generateRecipientToken() })),
      },
    },
  })

  return NextResponse.json({ ok: true, id: process.id, recipients: emails.length })
}
