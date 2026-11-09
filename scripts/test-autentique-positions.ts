/* Valida as positions de assinatura/rubrica: cria um doc de teste com as
 * posições do layout do contrato, assina via API, baixa o PDF assinado para
 * inspeção visual e DELETA o documento. Não imprime segredos.
 * Uso: npx tsx --env-file=.env scripts/test-autentique-positions.ts */
import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import { renderContractPdf, buildContractData, contractSignaturePositions } from '../src/lib/contract'
import { DEFAULT_CONTRACT_TEMPLATE } from '../src/lib/fields'

const GRAPHQL_URL = 'https://api.autentique.com.br/v2/graphql'

async function gql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json || json.errors) {
    const msg = json?.errors?.map?.((e: { message: string }) => e.message).join('; ') || `HTTP ${res.status}`
    throw new Error(`Autentique: ${msg}`)
  }
  return json.data as T
}

async function main() {
  const db = new PrismaClient()
  const s = await db.settings.findUnique({ where: { id: 'singleton' } })
  await db.$disconnect()
  if (!s?.autentiqueToken || !s.adminSignerEmail || !s.adminSignerName) {
    console.log('SEM_CONFIG: token/e-mail do admin não configurados.')
    return
  }
  const token = s.autentiqueToken

  const form = {
    nome_completo: 'Maria da Silva Souza', cpf: '123.456.789-00', email: 'maria@email.com',
    cidade: 'São Paulo', estado: 'SP',
  }
  const data = buildContractData(form, { name: 'TESTE positions', referenceDate: '2026-11-20', amount: 1500 }, s.adminSignerName)
  // template alongado = 2 páginas de conteúdo (rubricas na 1ª, assinaturas na 2ª)
  const longTemplate = DEFAULT_CONTRACT_TEMPLATE + `

CLÁUSULA 6 — CONFIDENCIALIDADE

6.1. As partes obrigam-se a manter sigilo sobre todas as informações trocadas no âmbito deste contrato, incluindo dados pessoais, acadêmicos e financeiros.

6.2. A obrigação de sigilo sobrevive à rescisão deste contrato pelo prazo de 2 (dois) anos.

CLÁUSULA 7 — PROTEÇÃO DE DADOS

7.1. O tratamento de dados pessoais ocorre conforme a Lei nº 13.709/2018 (LGPD), limitando-se ao uso para execução dos serviços aqui contratados.

7.2. O(A) CONTRATANTE pode solicitar acesso, correção ou eliminação de seus dados pelos canais informados na plataforma.

CLÁUSULA 8 — RESCISÃO

8.1. O presente contrato pode ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias, sem prejuízo dos serviços já prestados.`
  const pdf = await renderContractPdf(longTemplate, data)
  const { PDFDocument } = await import('pdf-lib')
  const pageCount = (await PDFDocument.load(pdf)).getPageCount()
  const pos = contractSignaturePositions(pageCount)
  // exatamente como o pipeline envia
  const positions = [...pos.contratante.rubricas, pos.contratante.assinatura, ...pos.contratado.rubricas, pos.contratado.assinatura]
  console.log('positions enviadas:', JSON.stringify(positions))

  const operations = JSON.stringify({
    query: `mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
      createDocument(document: $document, signers: $signers, file: $file) { id }
    }`,
    variables: {
      document: { name: 'TESTE positions (apagar)' },
      signers: [{ email: s.adminSignerEmail, action: 'SIGN', name: s.adminSignerName, positions }],
      file: null,
    },
  })
  const fd = new FormData()
  fd.append('operations', operations)
  fd.append('map', JSON.stringify({ file: ['variables.file'] }))
  fd.append('file', new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), 'contrato.pdf')
  const res = await fetch(GRAPHQL_URL, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json || json.errors) {
    throw new Error('createDocument: ' + (json?.errors?.map?.((e: { message: string }) => e.message).join('; ') || `HTTP ${res.status}`))
  }
  const docId = json.data.createDocument.id as string
  console.log('documento criado:', docId)

  try {
    await gql(token, 'mutation ($documentId: UUID!) { signDocument(id: $documentId) }', { documentId: docId })
    let signedUrl: string | null = null
    for (let i = 0; i < 10 && !signedUrl; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const doc = await gql<{ document: { files: { signed: string | null } } }>(
        token,
        'query ($documentId: UUID!) { document(id: $documentId) { files { signed } } }',
        { documentId: docId }
      )
      signedUrl = doc.document.files?.signed
    }
    if (!signedUrl) throw new Error('files.signed não ficou disponível em 20s')
    const dl = await fetch(signedUrl, { headers: { Authorization: `Bearer ${token}` } })
    if (!dl.ok) throw new Error(`download: HTTP ${dl.status}`)
    fs.mkdirSync('.tmp-render', { recursive: true })
    fs.writeFileSync('.tmp-render/positions-signed.pdf', Buffer.from(new Uint8Array(await dl.arrayBuffer())))
    console.log('PDF assinado salvo em .tmp-render/positions-signed.pdf')
  } finally {
    try {
      await gql(token, 'mutation ($id: UUID!) { deleteDocument(id: $id) }', { id: docId })
      console.log('documento de teste removido')
    } catch (e) {
      console.log('ATENÇÃO: não consegui remover', docId, '-', e instanceof Error ? e.message : e)
    }
  }
}

main().catch((e) => {
  console.error('FALHOU:', e instanceof Error ? e.message : e)
  process.exitCode = 1
})
