/** Testa a geração do PDF do contrato com dados FICTÍCIOS.
 * Nunca colocar PII real aqui: o arquivo é versionado no git. */
import { renderContractPdf, buildContractData } from '../src/lib/contract'
import { writeFileSync } from 'fs'

const formData = {
  email: 'maria@teste.com',
  nome_completo: 'Maria Souza da Silva',
  cpf: 'XXX.XXX.XXX-XX',
  rg: 'XX.XXX.XXX-X',
  telefone: '(11) 90000-0000',
  data_nascimento: '1990-01-01',
  rua: 'Rua Exemplo',
  numero: 'S/N',
  bairro: 'Centro',
  cidade: 'São Paulo',
  cep: '00000-000',
  estado: 'SP',
}

const template = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

PROCESSO: {{processo_nome}} — Referência: {{data_referencia}}

IDENTIFICAÇÃO DAS PARTES

CONTRATANTE: {{nome_completo}}, portador(a) do CPF nº {{cpf}}{{rg_campo}}{{telefone_campo}}{{nascimento_campo}}, residente e domiciliado(a) em {{rua}}, nº {{numero}}, bairro {{bairro}}, CEP {{cep}}, cidade de {{cidade}}/{{estado}}, e-mail {{email}}.

CLÁUSULA 1 — OBJETO
1.1. O presente contrato tem por objeto a prestação de serviços descriminados no processo "{{processo_nome}}", conforme condições aqui estabelecidas. Este parágrafo é propositalmente longo para testar a quebra de linha automática do gerador de PDF, garantindo que o texto saia legível, com margens corretas e sem sobreposição de palavras — inclusive com acentuação: ação, coração, contribuição, Avaliação de desempenho e serviços de manutenção preventiva e corretiva.

CLÁUSULA 2 — VALOR E FORMA DE PAGAMENTO
2.1. Pelos serviços prestados, o(a) CONTRATANTE pagará ao CONTRATADO o valor de {{valor}}.

CLÁUSULA 3 — VARIÁVEL VAZIA
3.1. Campo inexistente: {{campo_que_nao_existe}} deve virar traços.`

async function main() {
  const data = buildContractData(formData, { name: 'Contratos Exemplo', referenceDate: '05/11/2026', amount: 1500 }, 'Nome do Contratado')
  const pdf = await renderContractPdf(template, data)
  writeFileSync('/tmp/render/contrato-teste.pdf', pdf)
  console.log('PDF gerado:', pdf.length, 'bytes')
}

main().catch((e) => {
  console.error('ERRO:', e)
  process.exit(1)
})
