'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, FolderKanban } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrencyBRL, formatDateBR } from '@/lib/format'

type ProcessItem = {
  id: string
  name: string
  referenceDate: string
  amount: number | null
  status: string
  createdAt: string
  recipientCount: number
  recipientStatuses: Record<string, number>
}

export default function ProcessosPage() {
  const router = useRouter()
  const [processes, setProcesses] = useState<ProcessItem[] | null>(null)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/admin/processes')
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      const data = await res.json()
      setProcesses(data.processes)
    }
    void load()
  }, [router])

  return (
    <AdminShell>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Processos</h1>
          <p className="text-sm text-zinc-500">Cada envio em massa é um processo independente, com nome e data de referência.</p>
        </div>
        <Button asChild className="sm:ml-auto">
          <Link href="/processos/novo">
            <Plus className="mr-1.5 h-4 w-4" /> Novo envio em massa
          </Link>
        </Button>
      </div>

      {processes === null ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : processes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderKanban className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
            <p className="text-sm text-zinc-500 mb-4">Nenhum processo criado ainda.</p>
            <Button asChild>
              <Link href="/processos/novo">
                <Plus className="mr-1.5 h-4 w-4" /> Criar primeiro envio
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {processes.map((p) => (
            <Link key={p.id} href={`/processos/${p.id}`}>
              <Card className="hover:border-emerald-300 transition-colors">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-zinc-500">
                      Ref. {p.referenceDate} · {p.recipientCount} pessoa(s)
                      {p.amount ? ` · ${formatCurrencyBRL(p.amount)}` : ''} · criado em {formatDateBR(p.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    {p.recipientStatuses['fila'] ? <span className="rounded-full bg-zinc-100 px-2 py-0.5">{p.recipientStatuses['fila']} na fila</span> : null}
                    {p.recipientStatuses['form_enviado'] ? <span className="rounded-full bg-sky-50 text-sky-700 px-2 py-0.5">{p.recipientStatuses['form_enviado']} aguardando form</span> : null}
                    {p.recipientStatuses['contrato_enviado'] ? <span className="rounded-full bg-amber-50 text-amber-700 px-2 py-0.5">{p.recipientStatuses['contrato_enviado']} aguardando assinatura</span> : null}
                    {p.recipientStatuses['pagamento_enviado'] ? <span className="rounded-full bg-violet-50 text-violet-700 px-2 py-0.5">{p.recipientStatuses['pagamento_enviado']} aguardando pgto</span> : null}
                    {p.recipientStatuses['pago'] ? <span className="rounded-full bg-emerald-600 text-white px-2 py-0.5">{p.recipientStatuses['pago']} pago</span> : null}
                    {p.recipientStatuses['erro'] ? <span className="rounded-full bg-red-50 text-red-700 px-2 py-0.5">{p.recipientStatuses['erro']} com erro</span> : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
