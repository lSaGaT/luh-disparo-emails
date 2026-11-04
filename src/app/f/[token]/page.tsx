'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Loader2, FileSignature } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { applyMask } from '@/lib/format'

type FieldInfo = { key: string; label: string; type: string; placeholder: string; mask: string | null }
type FormInfo = { processName: string; referenceDate: string; recipientName: string; email: string; alreadySubmitted: boolean; fields: FieldInfo[] }

export default function FormularioPage() {
  const params = useParams<{ token: string }>()
  const token = params.token

  const [info, setInfo] = useState<FormInfo | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/public/form/${token}`)
      if (!res.ok) {
        setNotFound(true)
        return
      }
      const data = (await res.json()) as FormInfo
      setInfo(data)
      if (data.alreadySubmitted) setDone(true)
    })()
  }, [token])

  const setField = (key: string, mask: string | null, value: string) => {
    setValues((prev) => ({ ...prev, [key]: mask ? applyMask(value, mask as 'cpf' | 'cep' | 'tel') : value }))
  }

  const lookupCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) return
      const data = await res.json()
      if (data.erro) return
      setValues((prev) => ({
        ...prev,
        ...(data.logradouro ? { rua: prev.rua || data.logradouro } : {}),
        ...(data.bairro ? { bairro: prev.bairro || data.bairro } : {}),
        ...(data.localidade ? { cidade: prev.cidade || data.localidade } : {}),
        ...(data.uf ? { estado: prev.estado || data.uf } : {}),
      }))
    } catch {
      // sem preenchimento automático
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/public/form/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: values }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Não foi possível enviar.')
        return
      }
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  const ordenedFields = useMemo(() => info?.fields ?? [], [info])

  if (notFound) {
    return (
      <PublicLayout>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-lg font-medium mb-1">Link inválido</p>
            <p className="text-sm text-zinc-500">Este link de formulário não existe ou foi removido. Confira o endereço recebido no seu e-mail.</p>
          </CardContent>
        </Card>
      </PublicLayout>
    )
  }

  if (done) {
    return (
      <PublicLayout>
        <Card>
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600 mb-3" />
            <p className="text-lg font-medium mb-1">Formulário enviado!</p>
            <p className="text-sm text-zinc-500 mb-6">Recebemos seus dados. Seu contrato será gerado e o link para assinatura chegará no seu e-mail em instantes.</p>
            <Button asChild variant="outline">
              <Link href={`/p/${token}`}>Acompanhar meu processo</Link>
            </Button>
          </CardContent>
        </Card>
      </PublicLayout>
    )
  }

  if (!info) {
    return (
      <PublicLayout>
        <div className="text-center py-16 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold uppercase tracking-wide">
            <FileSignature className="h-4 w-4" /> Formulário de contrato
          </div>
          <CardTitle>Processo: {info.processName}</CardTitle>
          <CardDescription>
            Referência {info.referenceDate} · Preencha seus dados para gerarmos o seu contrato. Os dados serão usados no documento oficial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome_confirmacao">Seu nome (cadastro)</Label>
              <Input id="nome_confirmacao" value={info.recipientName} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Seu e-mail (cadastro)</Label>
              <Input id="email" value={info.email} disabled />
            </div>

            {ordenedFields.map((f) =>
              f.key === 'email' ? null : (
                <div key={f.key} className={`space-y-2 ${['rua', 'rua'].includes(f.key) ? 'sm:col-span-2' : ''}`}>
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Input
                    id={f.key}
                    type={f.type}
                    placeholder={f.placeholder}
                    value={values[f.key] || ''}
                    onChange={(e) => setField(f.key, f.mask, e.target.value)}
                    onBlur={f.key === 'cep' ? () => lookupCep(values.cep || '') : undefined}
                    required
                    maxLength={f.type === 'date' ? undefined : 120}
                  />
                </div>
              )
            )}

            {error && (
              <Alert variant="destructive" className="sm:col-span-2">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="sm:col-span-2">
              <Button type="submit" className="w-full sm:w-auto" size="lg" disabled={submitting}>
                {submitting ? 'Enviando…' : 'Enviar meus dados'}
              </Button>
              <p className="text-xs text-zinc-400 mt-3">
                Ao enviar, você declara que as informações são verdadeiras e concorda com a assinatura eletrônica do contrato.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </PublicLayout>
  )
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
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
        <p className="text-center text-xs text-zinc-400">Formulário seguro — seus dados são usados apenas para a geração do contrato.</p>
      </footer>
    </div>
  )
}
