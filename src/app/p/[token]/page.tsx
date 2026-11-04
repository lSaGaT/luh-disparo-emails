'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  CheckCircle2,
  Circle,
  Loader2,
  FileSignature,
  CreditCard,
  FileText,
  Download,
  Mail,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

type StatusData = {
  name: string
  processName: string
  referenceDate: string
  status: string
  error: string | null
  email: string
  submittedAt: string | null
  contractSentAt: string | null
  signedAt: string | null
  paymentSentAt: string | null
  paidAt: string | null
  signUrl: string | null
  paymentUrl: string | null
  hasSignedPdf: boolean
  adminSigned: boolean
  formFields: { label: string; value: string }[]
}

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : null

export default function StatusPessoaPage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const [data, setData] = useState<StatusData | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/public/status/${token}`)
      if (!res.ok) {
        setNotFound(true)
        return
      }
      setData(await res.json())
    }
    void load()
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [token])

  if (notFound) {
    return (
      <PublicShell>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-lg font-medium mb-1">Link inválido</p>
            <p className="text-sm text-zinc-500">Este link de acompanhamento não existe. Confira o endereço recebido no seu e-mail.</p>
          </CardContent>
        </Card>
      </PublicShell>
    )
  }

  if (!data) {
    return (
      <PublicShell>
        <div className="text-center py-16 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      </PublicShell>
    )
  }

  const steps = [
    { label: 'Formulário enviado', done: !!data.submittedAt, at: fmt(data.submittedAt), icon: Mail },
    { label: 'Contrato gerado e enviado para assinatura', done: !!data.contractSentAt, at: fmt(data.contractSentAt), icon: FileSignature },
    { label: 'Contrato assinado pelas duas partes', done: !!data.signedAt, at: fmt(data.signedAt), icon: CheckCircle2 },
    { label: 'Link de pagamento enviado', done: !!data.paymentSentAt, at: fmt(data.paymentSentAt), icon: CreditCard },
    { label: 'Pagamento confirmado', done: !!data.paidAt, at: fmt(data.paidAt), icon: CheckCircle2 },
  ]

  const pago = data.status === 'pago'

  return (
    <PublicShell>
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold uppercase tracking-wide">
            <Clock className="h-4 w-4" /> Acompanhamento do processo
          </div>
          <CardTitle>{data.processName}</CardTitle>
          <CardDescription>
            {data.name} · referência {data.referenceDate}
            {pago ? ' — concluído, obrigado!' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                {s.done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-zinc-300 mt-0.5 shrink-0" />
                )}
                <div>
                  <div className={`text-sm ${s.done ? 'font-medium' : 'text-zinc-500'}`}>{s.label}</div>
                  {s.at && <div className="text-xs text-zinc-400">{s.at}</div>}
                </div>
              </li>
            ))}
          </ol>
          {data.error && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              Ocorreu um problema: {data.error}. Tente novamente em alguns minutos ou entre em contato com o responsável.
            </div>
          )}
        </CardContent>
      </Card>

      {(data.signUrl || data.paymentUrl || data.hasSignedPdf) && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Meus documentos e ações</CardTitle>
            <CardDescription>Segunda via e links disponíveis para você.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {data.signUrl && !data.signedAt && (
              <Button asChild>
                <a href={data.signUrl} target="_blank" rel="noreferrer">
                  <FileSignature className="mr-1.5 h-4 w-4" /> Assinar contrato
                </a>
              </Button>
            )}
            {data.signedAt && !pago && data.paymentUrl && (
              <Button asChild>
                <a href={data.paymentUrl} target="_blank" rel="noreferrer">
                  <CreditCard className="mr-1.5 h-4 w-4" /> Pagar agora
                </a>
              </Button>
            )}
            {data.paymentUrl && (
              <Button asChild variant="outline">
                <a href={data.paymentUrl} target="_blank" rel="noreferrer">
                  <CreditCard className="mr-1.5 h-4 w-4" /> 2ª via do link de pagamento
                </a>
              </Button>
            )}
            {data.hasSignedPdf && (
              <Button asChild variant="outline">
                <a href={`/api/public/signed/${token}`} target="_blank" rel="noreferrer">
                  <Download className="mr-1.5 h-4 w-4" /> Baixar cópia assinada (PDF)
                </a>
              </Button>
            )}
            {!data.hasSignedPdf && (
              <Button asChild variant="outline">
                <a href={`/api/public/signed/${token}`} target="_blank" rel="noreferrer">
                  <FileText className="mr-1.5 h-4 w-4" /> Ver contrato gerado (PDF)
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {data.formFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meus dados informados</CardTitle>
            <CardDescription>Dados que você preencheu no formulário.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {data.formFields.map((f, i) => (
                <li key={i} className="py-2 flex gap-3">
                  <span className="text-zinc-500 w-36 shrink-0">{f.label}</span>
                  <span className="font-medium break-all">{f.value}</span>
                </li>
              ))}
            </ul>
            <Separator className="my-3" />
            <p className="text-xs text-zinc-400">Precisa corrigir algo? Fale com o responsável pelo processo.</p>
          </CardContent>
        </Card>
      )}
    </PublicShell>
  )
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-2xl px-4 h-14 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">CD</span>
          <span className="font-semibold text-zinc-900">Central de Documentos</span>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-8">{children}</main>
      <footer className="mt-auto border-t bg-white py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-center text-xs text-zinc-400">Central de Documentos — contratos com assinatura eletrônica e cobrança digital.</p>
      </footer>
    </div>
  )
}
