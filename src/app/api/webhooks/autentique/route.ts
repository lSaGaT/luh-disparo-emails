import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSettings } from '@/lib/settings'
import { stepFinalizeSignature } from '@/lib/pipeline'

/**
 * Webhook da Autentique — registra o evento e, quando o documento fica
 * totalmente assinado, dispara a finalização (cópia + cobrança).
 * Configure a URL nas configurações de webhook do painel da Autentique.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text()
  let payload: Record<string, unknown> | null = null
  try {
    payload = JSON.parse(raw)
  } catch {
    payload = null
  }

  const event = (payload?.event || {}) as Record<string, unknown>
  const type = String(event.type || '')
  const data = (event.data || {}) as Record<string, unknown>
  const obj = (data.object || {}) as Record<string, unknown>
  const doc = (obj.document || {}) as Record<string, unknown>
  const documentId = String(doc.id || obj.id || '')

  const log = await db.webhookLog.create({
    data: {
      source: 'autentique',
      body: raw.slice(0, 1000),
      handled: false,
      note: `${type || 'evento sem tipo'} doc=${documentId || '?'}`,
    },
  })

  if (!documentId) return NextResponse.json({ ok: true })

  const relevant = [
    'document.finished',
    'signature.accepted',
    'document.updated',
  ]
  if (!relevant.includes(type)) return NextResponse.json({ ok: true })

  const recipient = await db.recipient.findFirst({
    where: { autentiqueDocId: documentId, status: 'contrato_enviado' },
  })
  if (!recipient) {
    await db.webhookLog.update({ where: { id: log.id }, data: { note: `${log.note} | recipient não encontrado` } })
    return NextResponse.json({ ok: true })
  }

  // confere com a API antes de finalizar (evita depender só do payload)
  const settings = await getSettings()
  if (settings.autentiqueToken) {
    try {
      const { getDocument } = await import('@/lib/autentique')
      const docStatus = await getDocument(settings.autentiqueToken, documentId)
      const allSigned = docStatus.signatures.length > 0 && docStatus.signatures.every((s) => !!s.signed)
      if (allSigned || docStatus.files?.signed) {
        await stepFinalizeSignature(recipient.id)
        await db.webhookLog.update({ where: { id: log.id }, data: { handled: true } })
      }
    } catch {
      // sondagem periódica cobre depois
    }
  }

  return NextResponse.json({ ok: true })
}
