import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isLinkExpired } from '@/lib/public-token'

/** Baixa a cópia assinada (ou o contrato gerado) em PDF. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const r = await db.recipient.findUnique({ where: { token } })
  if (!r || isLinkExpired(r)) return NextResponse.json({ error: 'Link inválido.' }, { status: 404 })

  const b64 = r.signedPdfB64 || r.generatedPdfB64
  if (!b64) return NextResponse.json({ error: 'Documento ainda não disponível.' }, { status: 404 })

  const buffer = Buffer.from(b64, 'base64')
  const filename = r.signedPdfB64 ? 'contrato-assinado.pdf' : 'contrato.pdf'
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
