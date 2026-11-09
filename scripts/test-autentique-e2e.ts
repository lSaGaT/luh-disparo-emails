/* Testa E2E da assinatura Autentique com o layout atual do contrato:
 * gera o PDF (template salvo nas settings), cria o documento, assina via API
 * como o admin (dono do token), baixa o PDF assinado e DELETA o documento.
 * Não imprime segredos. Uso: npx tsx --env-file=.env scripts/test-autentique-e2e.ts */
import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import { renderContractPdf, buildContractData } from '../src/lib/contract'
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
  if (!s?.autentiqueToken) {
    console.log('SEM_TOKEN: configure o token da Autentique em Configurações antes deste teste.')
    return
  }
  if (!s.adminSignerEmail || !s.adminSignerName) {
    console.log('SEM_ADMIN: configure nome/e-mail do assinante administrador em Configurações.')
    return
  }
  const token = s.autentiqueToken

  // 1) valida o token (mesmo probe do app)
  await gql(token, 'query { me { id } }', {})
  console.log('1. token válido')

  // 2) gera o PDF exatamente como o pipeline (template salvo, dados fictícios)
  const form = {
    nome_completo: 'Maria da Silva Souza', cpf: '123.456.789-00', email: 'maria@email.com',
    rg: '12.345.678-9', telefone: '(11) 98765-4321', data_nascimento: '2000-05-14',
    cep: '01310-930', rua: 'Avenida Paulista', numero: '1578', complemento: 'Apto 92, Bloco B',
    bairro: 'Bela Vista', cidade: 'São Paulo', estado: 'SP',
    nome_aluno: 'João Souza Andrade', turma: '9º A', serie: '9º ano', altura: '1,65 m',
  }
  const data = buildContractData(form, { name: 'TESTE E2E layout', referenceDate: '2026-11-20', amount: 1500 }, s.adminSignerName)
  const pdf = await renderContractPdf(s.contractTemplate || DEFAULT_CONTRACT_TEMPLATE, data)
  console.log('2. PDF gerado,', pdf.length, 'bytes')

  // 3) cria o documento com UM signatário (o admin, dono do token) para que a
  // assinatura via API complete o documento e libere files.signed
  const operations = JSON.stringify({
    query: `mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
      createDocument(document: $document, signers: $signers, file: $file) { id signatures { public_id email link { short_link } } }
    }`,
    variables: {
      document: { name: 'TESTE E2E layout assinaturas (apagar)' },
      signers: [{ email: s.adminSignerEmail, action: 'SIGN', name: s.adminSignerName }],
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
  console.log('3. documento criado:', docId)

  try {
    // 4) assina como o admin (mesma mutation do pipeline)
    const signed = await gql<{ signDocument: boolean }>(token, `mutation ($documentId: UUID!) { signDocument(id: $documentId) }`, { documentId: docId })
    console.log('4. signDocument:', signed)

    // 5) espera files.signed ficar disponível
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
    const bytes = new Uint8Array(await dl.arrayBuffer())
    fs.mkdirSync('.tmp-render', { recursive: true })
    fs.writeFileSync('.tmp-render/assinado-e2e.pdf', Buffer.from(bytes))
    console.log('5. PDF assinado baixado:', bytes.length, 'bytes')
  } finally {
    // 6) remove o documento de teste da conta
    try {
      await gql(token, 'mutation ($id: UUID!) { deleteDocument(id: $id) }', { id: docId })
      console.log('6. documento de teste removido da Autentique')
    } catch (e) {
      console.log('6. ATENÇÃO: não consegui remover', docId, '-', e instanceof Error ? e.message : e)
    }
  }
}

main().catch((e) => {
  console.error('FALHOU:', e instanceof Error ? e.message : e)
  process.exitCode = 1
})
