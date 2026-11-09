/** Janela de edição do formulário: a pessoa pode corrigir os dados enviados
 * somente até 3 dias antes do "evento" (data de referência do processo).
 * Faltando 3 dias ou menos (ou depois da data), a edição é bloqueada.
 * referenceDate vem de <input type="date">: YYYY-MM-DD, interpretado no
 * fuso local (meia-noite) para evitar deslocamento de UTC.
 */
export const EDIT_WINDOW_DAYS = 3

export type EditWindow = {
  allowed: boolean
  /** Dias inteiros que faltam para o evento (negativo = já passou). */
  daysLeft: number
}

export function checkEditWindow(referenceDate: string | null | undefined, now: Date = new Date()): EditWindow {
  if (!referenceDate) return { allowed: false, daysLeft: 0 }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(referenceDate.trim())
  if (!m) return { allowed: false, daysLeft: 0 }
  const event = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) // meia-noite local
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const daysLeft = Math.round((event.getTime() - today.getTime()) / 86400000)
  return { allowed: daysLeft > EDIT_WINDOW_DAYS, daysLeft }
}
