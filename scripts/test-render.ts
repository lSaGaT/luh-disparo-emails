/* Gera PDF de teste do contrato com o código atual (fora do Next). */
import fs from 'fs'
import { renderContractPdf, buildContractData } from '../src/lib/contract'
import { DEFAULT_CONTRACT_TEMPLATE } from '../src/lib/fields'

async function main() {
  const form = {
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
  const data = buildContractData(
    form,
    { name: 'Processo de exemplo', referenceDate: '2026-11-20', amount: 1500 },
    'Lucas Gabriel Rocha Ramos'
  )
  const pdf = await renderContractPdf(DEFAULT_CONTRACT_TEMPLATE, data)
  fs.writeFileSync('contrato-teste.pdf', Buffer.from(pdf))
  console.log('ok — contrato-teste.pdf gerado')

  // cenário de 2 páginas de conteúdo: valida rubricas nas páginas sem assinatura
  const longTemplate = DEFAULT_CONTRACT_TEMPLATE + `

CLÁUSULA 6 — CONFIDENCIALIDADE

6.1. As partes obrigam-se a manter sigilo sobre todas as informações trocadas no âmbito deste contrato, incluindo dados pessoais, acadêmicos e financeiros.

6.2. A obrigação de sigilo sobrevive à rescisão deste contrato pelo prazo de 2 (dois) anos.

CLÁUSULA 7 — PROTEÇÃO DE DADOS

7.1. O tratamento de dados pessoais ocorre conforme a Lei nº 13.709/2018 (LGPD), limitando-se ao uso para execução dos serviços aqui contratados.

7.2. O(A) CONTRATANTE pode solicitar acesso, correção ou eliminação de seus dados pelos canais informados na plataforma.

CLÁUSULA 8 — RESCISÃO

8.1. O presente contrato pode ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias, sem prejuízo dos serviços já prestados.

CLÁUSULA 9 — DISPOSIÇÕES GERAIS

9.1. A nulidade de qualquer cláusula não afeta as demais, que permanecem plenamente válidas e eficazes.

9.2. Este contrato constitui a integralidade do acordo entre as partes.`
  const pdfLong = await renderContractPdf(longTemplate, data)
  fs.writeFileSync('contrato-teste-2pag.pdf', Buffer.from(pdfLong))
  console.log('ok — contrato-teste-2pag.pdf gerado')
}

main()
