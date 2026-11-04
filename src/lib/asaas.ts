/**
 * Cliente da API v3 do Asaas.
 * Documentação: https://docs.asaas.com
 */

import { getSettings } from '@/lib/settings'

function baseUrl(env: string): string {
  return env === 'producao' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3'
}

async function asaasRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const s = await getSettings()
  if (!s.asaasApiKey) throw new Error('Asaas não configurado. Informe a API key em Configurações.')
  const res = await fetch(`${baseUrl(s.asaasEnv)}${path}`, {
    ...init,
    headers: {
      access_token: s.asaasApiKey,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || (json && json.errors)) {
    const msg = json?.errors?.map?.((e: { description: string }) => e.description).join('; ') || `HTTP ${res.status}`
    throw new Error(`Asaas: ${msg}`)
  }
  return json as T
}

export async function createCustomer(opts: { name: string; email: string; cpfCnpj: string; phone?: string }): Promise<{ id: string }> {
  return asaasRequest<{ id: string }>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: opts.name,
      email: opts.email,
      cpfCnpj: opts.cpfCnpj.replace(/\D/g, ''),
      ...(opts.phone ? { phone: opts.phone.replace(/\D/g, ''), mobilePhone: opts.phone.replace(/\D/g, '') } : {}),
    }),
  })
}

export async function createPayment(opts: {
  customerId: string
  value: number
  dueDate: string // YYYY-MM-DD
  description?: string
  externalReference?: string
}): Promise<{ id: string; invoiceUrl: string | null; status: string; value: number; dueDate: string }> {
  return asaasRequest('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: opts.customerId,
      billingType: 'UNDEFINED',
      value: opts.value,
      dueDate: opts.dueDate,
      ...(opts.description ? { description: opts.description } : {}),
      ...(opts.externalReference ? { externalReference: opts.externalReference } : {}),
    }),
  })
}

export async function getPayment(paymentId: string): Promise<{ id: string; status: string; invoiceUrl: string | null; value: number }> {
  return asaasRequest(`/payments/${paymentId}`)
}

export async function testApiKey(): Promise<boolean> {
  await asaasRequest('/myAccount/commercialInfo')
  return true
}

/** Status considerados como pago. */
export function isPaidStatus(status: string): boolean {
  return ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status)
}
