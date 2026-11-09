import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { renderContractPdf, buildContractData } from '@/lib/contract'
import { getSettings } from '@/lib/settings'

/** Dados fictícios para o preview — mostram como as variáveis ficam no papel timbrado. */
const SAMPLE_FORM = {
  nome_completo: 'Maria da Silva Souza',
  cpf: '123.456.789-00',
  email: 'maria@email.com',
  rg: '12.345.678-9',
  telefone: '(11) 98765-4321',
  data_nascimento: '2000-05-14',
  cep: '01310-930',
  rua: 'Avenida Paulista',
  numero: '1578',
  complemento: 'Apto 92, Bloco B',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  estado: 'SP',
  nome_aluno: 'João Souza Andrade',
  turma: '9º A',
  serie: '9º ano',
  altura: '1,65 m',
}

/** Modo visualização: renderiza o texto do editor no papel timbrado (PDF inline). */
export async function POST(request: NextRequest) {
  const auth = await requireSession(request)
  if ('response' in auth) return auth.response

  const raw = await request.text()
  if (raw.length > 200_000) return NextResponse.json({ error: 'Payload muito grande.' }, { status: 413 })
  const body = (() => {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })()
  const template = body && typeof body.template === 'string' ? body.template : ''
  if (!template.trim()) {
    return NextResponse.json({ error: 'Escreva o texto do contrato antes de visualizar.' }, { status: 400 })
  }
  if (template.length > 120_000) {
    return NextResponse.json({ error: 'Modelo de contrato muito extenso (máximo de 120.000 caracteres).' }, { status: 413 })
  }

  const s = await getSettings()
  const data = buildContractData(SAMPLE_FORM, { name: 'Processo de exemplo', referenceDate: '2026-11-20', amount: 1500 }, s.adminSignerName)

  const pdf = await renderContractPdf(template, data)
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="preview-contrato.pdf"',
      'Cache-Control': 'no-store',
    },
  })
}
