'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, FolderKanban, FileSignature, Clock, CheckCircle2, CreditCard, Mail } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { formatCurrencyBRL, formatDateBR } from '@/lib/format'

type Stats = {
  totalProcesses: number
  totalRecipients: number
  byStatus: Record<string, number>
  recentProcesses: { id: string; name: string; referenceDate: string; amount: number | null; status: string; createdAt: string; _count: { recipients: number } }[]
  lastEmails: { id: string; to: string; subject: string; ok: boolean; createdAt: string; error: string | null }[]
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/stats')
        if (res.status === 401) {
          router.replace('/login')
          return
        }
        const data = (await res.json()) as Stats
        setStats(data)
      } finally {
        setLoading(false)
      }
    }
    void load()
    const timer = setInterval(load, 8000)
    return () => clearInterval(timer)
  }, [router])

  const cards = [
    { label: 'Processos', value: stats?.totalProcesses ?? 0, icon: FolderKanban, href: '/processos' },
    { label: 'Aguardando formulário', value: stats?.byStatus?.['fila'] + stats?.byStatus?.['form_enviado'] || 0, icon: Clock, href: '/processos' },
    { label: 'Aguardando assinatura', value: stats?.byStatus?.['contrato_enviado'] || 0, icon: FileSignature, href: '/processos' },
    { label: 'Aguardando pagamento', value: stats?.byStatus?.['pagamento_enviado'] || 0, icon: CreditCard, href: '/processos' },
    { label: 'Concluídos (pagos)', value: stats?.byStatus?.['pago'] || 0, icon: CheckCircle2, href: '/processos' },
  ]

  return (
    <AdminShell>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
          <p className="text-sm text-zinc-500">Acompanhe os processos e a fila de envios em tempo real.</p>
        </div>
        <Button asChild className="sm:ml-auto">
          <Link href="/processos/novo">
            <Plus className="mr-1.5 h-4 w-4" /> Novo envio em massa
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-6">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="hover:border-emerald-300 transition-colors h-full">
              <CardContent className="p-4">
                <c.icon className="h-4 w-4 text-emerald-600 mb-2" />
                {loading ? (
                  <Skeleton className="h-8 w-12 mb-1" />
                ) : (
                  <div className="text-2xl font-semibold tabular-nums">{c.value}</div>
                )}
                <div className="text-xs text-zinc-500">{c.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Processos recentes</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : stats && stats.recentProcesses.length > 0 ? (
              <ul className="divide-y">
                {stats.recentProcesses.map((p) => (
                  <li key={p.id}>
                    <Link href={`/processos/${p.id}`} className="flex items-center gap-3 py-2.5 hover:bg-zinc-50 rounded-md px-2 -mx-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-zinc-500">
                          Ref. {p.referenceDate} · {p._count.recipients} pessoa(s)
                          {p.amount ? ` · ${formatCurrencyBRL(p.amount)}` : ''}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 whitespace-nowrap">{formatDateBR(p.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500 py-6 text-center">Nenhum processo ainda. Clique em “Novo envio em massa” para começar.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-zinc-400" /> Últimos e-mails disparados
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : stats && stats.lastEmails.length > 0 ? (
              <ul className="divide-y">
                {stats.lastEmails.map((e) => (
                  <li key={e.id} className="py-2 px-2 -mx-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${e.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="truncate flex-1">{e.to}</span>
                      <span className="text-xs text-zinc-400 whitespace-nowrap">{formatDateBR(e.createdAt)}</span>
                    </div>
                    <div className="text-xs text-zinc-500 truncate pl-4">{e.subject}</div>
                    {e.error && <div className="text-xs text-red-600 truncate pl-4">{e.error}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500 py-6 text-center">Nenhum e-mail enviado ainda.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
