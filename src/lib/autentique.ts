/**
 * Cliente da API v2 da Autentique (GraphQL).
 * Documentação: https://docs.autentique.com.br/api
 */

const GRAPHQL_URL = 'https://api.autentique.com.br/v2/graphql'

const CREATE_DOC_MUTATION = `mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
  createDocument(document: $document, signers: $signers, file: $file) {
    id
    name
    signatures {
      public_id
      email
      action { name }
      link { short_link }
    }
  }
}`

const SIGN_DOC_MUTATION = `mutation SignDocument($documentId: UUID!) {
  signDocument(id: $documentId)
}`

const GET_DOC_QUERY = `query GetDocument($documentId: UUID!) {
  document(id: $documentId) {
    id
    files { original signed pades }
    signatures {
      public_id
      email
      action { name }
      link { short_link }
      signed { created_at }
    }
  }
}`

async function gql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json || json.errors) {
    const msg = json?.errors?.map?.((e: { message: string }) => e.message).join('; ') || `HTTP ${res.status}`
    throw new Error(`Autentique: ${msg}`)
  }
  return json.data as T
}

export type SignatureInfo = {
  public_id: string
  email: string
  link?: { short_link: string | null } | null
  signed?: { created_at: string | null } | null
}

export type AutentiqueSignaturePosition = {
  /** % da largura da página (0-100) */
  x: string
  /** % da altura da página (0-100), medido do topo */
  y: string
  /** página, começa em 1 */
  z: number
  element: 'SIGNATURE' | 'NAME' | 'INITIALS' | 'DATE' | 'CPF'
}

export type AutentiqueSignerInput = {
  email: string
  action: 'SIGN'
  name?: string
  cpf?: string
  send_automatic_email?: boolean
  /** sem posições, a assinatura só aparece na página de auditoria da Autentique */
  positions?: AutentiqueSignaturePosition[]
}

/** Cria o documento para assinatura. Retorna id + links dos signatários. */
export async function createDocument(
  token: string,
  opts: { name: string; pdf: Uint8Array; signers: AutentiqueSignerInput[] }
): Promise<{ id: string; signatures: SignatureInfo[] }> {
  const makeRequest = (withAutoEmail: boolean) => {
    // schema atual da API: cpf não existe mais no topo do SignerInput —
    // o formato correto é configs: { cpf } (SignerConfigInput)
    const signers = opts.signers.map((s) => ({
      email: s.email,
      action: s.action,
      ...(s.name ? { name: s.name } : {}),
      ...(s.cpf ? { configs: { cpf: s.cpf } } : {}),
      ...(s.positions?.length ? { positions: s.positions } : {}),
      ...(withAutoEmail && s.send_automatic_email !== undefined ? { send_automatic_email: s.send_automatic_email } : {}),
    }))
    const operations = JSON.stringify({
      query: CREATE_DOC_MUTATION,
      variables: {
        document: { name: opts.name },
        signers,
        file: null,
      },
    })
    const map = JSON.stringify({ file: ['variables.file'] })
    const fd = new FormData()
    fd.append('operations', operations)
    fd.append('map', map)
    fd.append('file', new Blob([new Uint8Array(opts.pdf)], { type: 'application/pdf' }), 'contrato.pdf')
    return fd
  }

  const execute = async (fd: FormData) => {
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json || json.errors) {
      const msg = json?.errors?.map?.((e: { message: string }) => e.message).join('; ') || `HTTP ${res.status}`
      throw new Error(`Autentique: ${msg}`)
    }
    return json.data as { createDocument: { id: string; signatures: SignatureInfo[] } }
  }

  // Tenta com send_automatic_email; se a API rejeitar o campo, repete sem.
  let data
  try {
    data = await execute(makeRequest(true))
  } catch (err) {
    if (err instanceof Error && /send_automatic_email|unknown field|Cannot query/i.test(err.message)) {
      data = await execute(makeRequest(false))
    } else {
      throw err
    }
  }
  return data.createDocument
}

/** Assina o documento em nome do dono do token da API (deve constar como signatário). */
export async function signDocument(token: string, documentId: string): Promise<boolean> {
  const data = await gql<{ signDocument: boolean }>(token, SIGN_DOC_MUTATION, { documentId })
  return data.signDocument
}

export type DocumentStatus = {
  // o schema atual da API não tem mais `status` no Document — a conclusão é
  // derivada de signatures[].signed e files.signed
  files: { original: string | null; signed: string | null; pades: string | null }
  signatures: SignatureInfo[]
}

/** Consulta o documento (assinaturas, arquivos). */
export async function getDocument(token: string, documentId: string): Promise<DocumentStatus> {
  const data = await gql<{ document: DocumentStatus }>(token, GET_DOC_QUERY, { documentId })
  return data.document
}

/** Baixa o PDF assinado (bytes). */
export async function downloadSignedPdf(token: string, url: string): Promise<Uint8Array> {
  const tryFetch = async (withAuth: boolean) => {
    const res = await fetch(url, { headers: withAuth ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) throw new Error(`Autentique download: HTTP ${res.status}`)
    return new Uint8Array(await res.arrayBuffer())
  }
  try {
    return await tryFetch(true)
  } catch {
    return await tryFetch(false)
  }
}

/** Testa a validade do token. */
export async function testToken(token: string): Promise<boolean> {
  // o schema atual da API não tem mais `users`; `me` é o probe barato de auth
  await gql(token, 'query { me { id } }', {})
  return true
}
