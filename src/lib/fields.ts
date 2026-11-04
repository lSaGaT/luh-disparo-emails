/**
 * Campos coletáveis no formulário público.
 * nome_completo, cpf e email são sempre coletados (essenciais para o
 * contrato e para a cobrança no Asaas). Os demais são opcionais e podem
 * ser ligados/desligados por processo.
 */

export type FieldKey =
  | 'nome_completo'
  | 'rg'
  | 'cpf'
  | 'telefone'
  | 'email'
  | 'data_nascimento'
  | 'rua'
  | 'numero'
  | 'bairro'
  | 'cidade'
  | 'cep'
  | 'estado'

export type FieldType = 'text' | 'email' | 'date' | 'tel'

export type FieldDef = {
  key: FieldKey
  label: string
  type: FieldType
  placeholder?: string
  mask?: 'cpf' | 'cep' | 'tel'
  alwaysOn: boolean
  toggleable: boolean
}

export const ALL_FIELDS: FieldDef[] = [
  { key: 'nome_completo', label: 'Nome completo', type: 'text', placeholder: 'Como no documento', alwaysOn: true, toggleable: false },
  { key: 'cpf', label: 'CPF', type: 'text', placeholder: '000.000.000-00', mask: 'cpf', alwaysOn: true, toggleable: false },
  { key: 'email', label: 'E-mail', type: 'email', placeholder: 'voce@email.com', alwaysOn: true, toggleable: false },
  { key: 'rg', label: 'RG', type: 'text', placeholder: 'Número do RG', alwaysOn: false, toggleable: true },
  { key: 'telefone', label: 'Telefone / WhatsApp', type: 'tel', placeholder: '(00) 00000-0000', mask: 'tel', alwaysOn: false, toggleable: true },
  { key: 'data_nascimento', label: 'Data de nascimento', type: 'date', alwaysOn: false, toggleable: true },
  { key: 'rua', label: 'Rua / Avenida', type: 'text', placeholder: 'Logradouro', alwaysOn: false, toggleable: true },
  { key: 'numero', label: 'Número', type: 'text', placeholder: 'Nº e complemento', alwaysOn: false, toggleable: true },
  { key: 'bairro', label: 'Bairro', type: 'text', placeholder: 'Bairro', alwaysOn: false, toggleable: true },
  { key: 'cidade', label: 'Cidade', type: 'text', placeholder: 'Cidade', alwaysOn: false, toggleable: true },
  { key: 'cep', label: 'CEP', type: 'text', placeholder: '00000-000', mask: 'cep', alwaysOn: false, toggleable: true },
  { key: 'estado', label: 'Estado', type: 'text', placeholder: 'UF (ex.: SP)', alwaysOn: false, toggleable: true },
]

export const DEFAULT_ENABLED_FIELDS: FieldKey[] = [
  'nome_completo',
  'cpf',
  'email',
  'rg',
  'telefone',
  'data_nascimento',
  'rua',
  'numero',
  'bairro',
  'cidade',
  'cep',
  'estado',
]

export function fieldDef(key: string): FieldDef | undefined {
  return ALL_FIELDS.find((f) => f.key === key)
}

export function parseFields(json: string | null | undefined): FieldKey[] {
  if (!json) return DEFAULT_ENABLED_FIELDS
  try {
    const arr = JSON.parse(json)
    if (Array.isArray(arr) && arr.length > 0) return arr as FieldKey[]
  } catch {
    // ignora e usa o padrão
  }
  return DEFAULT_ENABLED_FIELDS
}

/** Variáveis disponíveis no modelo do contrato ({{chave}}). */
export const TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: 'nome_completo', label: 'Nome completo' },
  { key: 'cpf', label: 'CPF' },
  { key: 'rg', label: 'RG' },
  { key: 'email', label: 'E-mail' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'data_nascimento', label: 'Data de nascimento' },
  { key: 'rua', label: 'Rua / Avenida' },
  { key: 'numero', label: 'Número' },
  { key: 'bairro', label: 'Bairro' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'cep', label: 'CEP' },
  { key: 'estado', label: 'Estado' },
  { key: 'processo_nome', label: 'Nome do processo' },
  { key: 'data_referencia', label: 'Data de referência do processo' },
  { key: 'valor', label: 'Valor da cobrança' },
  { key: 'data_contrato', label: 'Data de hoje' },
]

export const DEFAULT_CONTRACT_TEMPLATE = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

PROCESSO: {{processo_nome}} — Referência: {{data_referencia}}

IDENTIFICAÇÃO DAS PARTES

CONTRATANTE: {{nome_completo}}, portador(a) do CPF nº {{cpf}}{{rg_campo}}{{telefone_campo}}{{nascimento_campo}}, residente e domiciliado(a) em {{rua}}, nº {{numero}}, bairro {{bairro}}, CEP {{cep}}, cidade de {{cidade}}/{{estado}}, e-mail {{email}}.

CONTRATADO: o administrador desta plataforma, com sede no endereço informado no rodapé deste documento.

CLÁUSULA 1 — OBJETO

1.1. O presente contrato tem por objeto a prestação de serviços descriminados no processo "{{processo_nome}}", conforme condições aqui estabelecidas.

CLÁUSULA 2 — VALOR E FORMA DE PAGAMENTO

2.1. Pelos serviços prestados, o(a) CONTRATANTE pagará ao CONTRATADO o valor de {{valor}} (valor líquido de encargos bancários).

2.2. O pagamento será realizado mediante link de cobrança enviado ao e-mail {{email}} após a assinatura deste contrato.

CLÁUSULA 3 — DECLARAÇÃO DE VERACIDADE

3.1. O(A) CONTRATANTE declara que todos os dados informados no formulário eletrônico vinculado a este processo são verdadeiros e de sua autoria, responsabilizando-se civil e criminalmente por eventuais declarações falsas.

CLÁUSULA 4 — ASSINATURA ELETRÔNICA

4.1. As partes concordam que este documento seja assinado por meio de plataforma de assinatura eletrônica, sendo válidas as assinaturas eletrônicas conforme a Medida Provisória nº 2.200-2/2001 e o art. 10, § 2º da mesma.

CLÁUSULA 5 — FORO

5.1. Fica eleito o foro do domicílio do(a) CONTRATADO(A) para dirimir quaisquer dúvidas oriundas do presente contrato.

E, por estarem assim justas e contratadas, as partes assinam eletronicamente este documento.`
