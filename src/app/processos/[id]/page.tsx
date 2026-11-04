'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Play,
  Pause,
  Copy,
  RotateCcw,
  FileSignature,
  CreditCard,
  FileText,
  ExternalLink,
  Eye,
  MoreHorizontal,
  AlertTriangle,
} from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatCurrencyBRL, formatDateBR } from '@/lib/format'

type Recipient = {
  id: string
  name: string
  email: string
  token: string
  status: string
  stage: string | null
  error: string | null
  submittedAt: string | null
  signUrl: string | null
  paymentUrl: string | null
  signedAt: string | null
  paidAt: string | null
  adminSigned: boolean
  hasSignedPdf: boolean
  formUrl: string
  statusPageUrl: string
}

type ProcessData = {
  id: string
  name: string
  referenceDate: string
  amount: number | null
  dueDate: string | null
  description: string | null
  status: string
  formFields: string[]
  createdAt: string
}

export default function ProcessoDetalhePage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [process, setProcess] = useState<ProcessData | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(true)
  const [dataDialog, setDataDialog] = useState<{ name: string; fields: { label: string; value: string }[] } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/processes/${id}`, { cache: 'no-store' })
    if (res.status === 404) return
    if (res.status === 401) return
    const data = await res.json()
    setProcess(data.process)
    setRecipients(data.recipients)
    setLoading(false)
  }, [id])

  useEffect(() => {
    const t0 = setTimeout(() => void load(), 0)
    const timer = setInterval(() => void load(), 5000)
    return () => {
      clearTimeout(t0)
      clearInterval(timer)
    }
  }, [load])

  const start = async () => {
    await fetch(`/api/admin/processes/${id}/start`, { method: 'POST' })
    toast.success('Disparo iniciado — os e-mails serão enviados em fila, um de cada vez.')
    void load()
  }

  const pause = async () => {
    await fetch(`/api/admin/processes/${id}/pause`, { method: 'POST' })
    toast.info('Disparo pausado.')
    void load()
  }

  const resend = async (recipientId: string, kind: 'form' | 'contract' | 'payment' | 'copy') => {
    const res = await fetch(`/api/admin/recipients/${recipientId}/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('E-mail reenviado com sucesso!')
    } else {
      toast.error(data.error || 'Falha no reenvio.')
    }
    void load()
  }

  const retry = async (recipientId: string) => {
    await fetch(`/api/admin/recipients/${recipientId}/retry`, { method: 'POST' })
    toast.info('Reprocessando a etapa…')
    void load()
  }

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado!`)
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  const viewData = async (recipient: Recipient) => {
    const res = await fetch(`/api/public/status/${recipient.token}`)
    if (!res.ok) return
    const data = await res.json()
    setDataDialog({ name: recipient.name, fields: data.formFields || [] })
  }

  const counts = recipients.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})
  const naFila = counts['fila'] || 0
  const total = recipients.length

  return (
    <AdminShell>
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-zinc-500">
          <Link href="/processos">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{process?.name || '…'}</h1>
            <p className="text-sm text-zinc-500">
              {process && (
                <>
                  Ref. {process.referenceDate}
                  {process.amount ? ` · ${formatCurrencyBRL(process.amount)}` : ''}
                  {process.dueDate ? ` · vence em ${process.dueDate.split('-').reverse().join('/')}` : ''}
                </>
              )}
            </p>
          </div>
          {process && (
            <div className="flex items-center gap-2">
              {process.status === 'disparando' ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>
                    Fila ativa
                  </span>
                  <Button variant="outline" size="sm" onClick={pause}>
                    <Pause className="mr-1 h-4 w-4" /> Pausar
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={start} disabled={naFila === 0}>
                  <Play className="mr-1 h-4 w-4" /> Iniciar disparo
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <Card className="mb-4">
            <CardContent className="p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span><strong className="tabular-nums">{total}</strong> pessoas</span>
              {naFila > 0 && <span className="text-zinc-500">{naFila} na fila</span>}
              {(counts['form_enviado'] || 0) > 0 && <span className="text-sky-700">{counts['form_enviado']} preenchendo form</span>}
              {(counts['contrato_enviado'] || 0) > 0 && <span className="text-amber-700">{counts['contrato_enviado']} aguardando assinatura</span>}
              {(counts['assinado'] || 0) > 0 && <span className="text-emerald-700">{counts['assinado']} assinado(s)</span>}
              {(counts['pagamento_enviado'] || 0) > 0 && <span className="text-violet-700">{counts['pagamento_enviado']} aguardando pgto</span>}
              {(counts['pago'] || 0) > 0 && <span className="text-emerald-700 font-medium">{counts['pago']} pago(s)</span>}
              {(counts['erro'] || 0) > 0 && <span className="text-red-600">{counts['erro']} com erro</span>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pessoa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Linha do tempo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-zinc-500 py-8">Nenhuma pessoa na lista.</TableCell>
                      </TableRow>
                    )}
                    {recipients.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-zinc-500">{r.email}</div>
                          {r.status === 'erro' && r.error && (
                            <div className="mt-1 flex items-start gap-1 text-xs text-red-600 max-w-xs">
                              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                              <span className="break-words">{r.error}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                          {r.status === 'contrato_enviado' && r.adminSigned && (
                            <div className="mt-1 text-[11px] text-zinc-400">adm já assinou</div>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-zinc-500 space-y-0.5">
                          <div>Form: {r.submittedAt ? formatDateBR(r.submittedAt) : '—'}</div>
                          <div>Assinatura: {r.signedAt ? formatDateBR(r.signedAt) : '—'}</div>
                          <div>Pagamento: {r.paidAt ? formatDateBR(r.paidAt) : '—'}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" aria-label={`Ações para ${r.name}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                              <DropdownMenuItem onClick={() => copy(r.formUrl, 'Link do formulário')}>
                                <Copy className="mr-2 h-4 w-4" /> Copiar link do formulário
                              </DropdownMenuItem>
                              {r.status !== 'fila' && (
                                <DropdownMenuItem onClick={() => resend(r.id, 'form')}>
                                  <RotateCcw className="mr-2 h-4 w-4" /> Reenviar e-mail do formulário
                                </DropdownMenuItem>
                              )}
                              {r.submittedAt && (
                                <DropdownMenuItem onClick={() => viewData(r)}>
                                  <Eye className="mr-2 h-4 w-4" /> Ver dados preenchidos
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {r.signUrl && (
                                <>
                                  <DropdownMenuItem onClick={() => window.open(r.signUrl!, '_blank')}>
                                    <ExternalLink className="mr-2 h-4 w-4" /> Abrir link de assinatura
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => copy(r.signUrl!, 'Link de assinatura')}>
                                    <Copy className="mr-2 h-4 w-4" /> Copiar link de assinatura
                                  </DropdownMenuItem>
                                </>
                              )}
                              {(r.status === 'contrato_enviado' || r.status === 'finalizando_assinatura') && (
                                <DropdownMenuItem onClick={() => resend(r.id, 'contract')}>
                                  <FileSignature className="mr-2 h-4 w-4" /> Reenviar e-mail para assinar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {r.paymentUrl && (
                                <>
                                  <DropdownMenuItem onClick={() => window.open(r.paymentUrl!, '_blank')}>
                                    <ExternalLink className="mr-2 h-4 w-4" /> Abrir link de pagamento
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => copy(r.paymentUrl!, 'Link de pagamento')}>
                                    <Copy className="mr-2 h-4 w-4" /> Copiar link de pagamento
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => resend(r.id, 'payment')}>
                                    <CreditCard className="mr-2 h-4 w-4" /> Reenviar link de pagamento
                                  </DropdownMenuItem>
                                </>
                              )}
                              {r.hasSignedPdf && (
                                <>
                                  <DropdownMenuItem onClick={() => window.open(`/api/public/signed/${r.token}`, '_blank')}>
                                    <FileText className="mr-2 h-4 w-4" /> Abrir cópia assinada
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => resend(r.id, 'copy')}>
                                    <RotateCcw className="mr-2 h-4 w-4" /> Reenviar cópia assinada
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => window.open(r.statusPageUrl, '_blank')}>
                                <ExternalLink className="mr-2 h-4 w-4" /> Ver página da pessoa (2ª via)
                              </DropdownMenuItem>
                              {r.status === 'erro' && (
                                <DropdownMenuItem onClick={() => retry(r.id)} className="text-emerald-700">
                                  <RotateCcw className="mr-2 h-4 w-4" /> Tentar novamente
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!dataDialog} onOpenChange={(open) => !open && setDataDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados preenchidos — {dataDialog?.name}</DialogTitle>
            <DialogDescription>Informações enviadas pela pessoa no formulário.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            {dataDialog && dataDialog.fields.length > 0 ? (
              <ul className="divide-y text-sm">
                {dataDialog.fields.map((f, i) => (
                  <li key={i} className="py-2 flex gap-3">
                    <span className="text-zinc-500 w-40 shrink-0">{f.label}</span>
                    <span className="font-medium break-all">{f.value}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">Nenhum dado registrado.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}
