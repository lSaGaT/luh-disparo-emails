/** Metadados de status compartilhados entre telas (sem imports de servidor). */

export type RecipientStatus =
  | 'fila'
  | 'form_enviado'
  | 'form_recebido'
  | 'gerando_contrato'
  | 'contrato_enviado'
  | 'finalizando_assinatura'
  | 'assinado'
  | 'gerando_cobranca'
  | 'pagamento_enviado'
  | 'pago'
  | 'erro'

export const STATUS_META: Record<string, { label: string; description: string; tone: string; step: number }> = {
  fila: { label: 'Na fila', description: 'Aguardando disparo do e-mail', tone: 'bg-zinc-100 text-zinc-700 border-zinc-200', step: 0 },
  form_enviado: { label: 'Formulário enviado', description: 'Aguardando a pessoa preencher', tone: 'bg-sky-50 text-sky-700 border-sky-200', step: 1 },
  form_recebido: { label: 'Formulário recebido', description: 'Dados preenchidos pela pessoa', tone: 'bg-teal-50 text-teal-700 border-teal-200', step: 2 },
  gerando_contrato: { label: 'Gerando contrato', description: 'Contrato sendo gerado e enviado para assinatura', tone: 'bg-amber-50 text-amber-700 border-amber-200', step: 2 },
  contrato_enviado: { label: 'Aguardando assinatura', description: 'Contrato enviado para a pessoa assinar', tone: 'bg-amber-100 text-amber-800 border-amber-300', step: 3 },
  finalizando_assinatura: { label: 'Finalizando assinatura', description: 'Coletando o PDF assinado na Autentique', tone: 'bg-amber-50 text-amber-700 border-amber-200', step: 3 },
  assinado: { label: 'Assinado', description: 'Contrato assinado pelas duas partes', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', step: 4 },
  gerando_cobranca: { label: 'Gerando cobrança', description: 'Criando o link de pagamento no Asaas', tone: 'bg-amber-50 text-amber-700 border-amber-200', step: 4 },
  pagamento_enviado: { label: 'Pagamento enviado', description: 'Link de pagamento enviado, aguardando pagamento', tone: 'bg-violet-50 text-violet-700 border-violet-200', step: 5 },
  pago: { label: 'Pago', description: 'Pagamento confirmado', tone: 'bg-emerald-600 text-white border-emerald-600', step: 6 },
  erro: { label: 'Erro', description: 'Falha em uma etapa', tone: 'bg-red-50 text-red-700 border-red-200', step: -1 },
}

export function statusMeta(status: string) {
  return STATUS_META[status] || { label: status, description: '', tone: 'bg-zinc-100 text-zinc-700 border-zinc-200', step: -1 }
}
