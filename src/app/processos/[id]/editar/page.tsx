'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AdminShell } from '@/components/admin-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ALL_FIELDS } from '@/lib/fields'

export default function EditarProcessoPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()

  const [name, setName] = useState('')
  const [referenceDate, setReferenceDate] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [enabled, setEnabled] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/admin/processes/${id}`, { cache: 'no-store' })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) {
        toast.error('Processo não encontrado.')
        router.replace('/processos')
        return
      }
      const data = await res.json()
      setName(data.process.name)
      setReferenceDate(data.process.referenceDate)
      setAmount(data.process.amount ? String(data.process.amount) : '')
      setDueDate(data.process.dueDate || '')
      setDescription(data.process.description || '')
      setEnabled(data.process.formFields)
      setLoading(false)
    })()
  }, [id, router])

  const toggleField = (key: string, toggleable: boolean) => {
    if (!toggleable) return
    setEnabled((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/processes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          referenceDate,
          amount: amount ? Number(amount.replace(',', '.')) : null,
          dueDate: dueDate || null,
          description: description || null,
          formFields: enabled,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Não foi possível salvar as alterações.')
        return
      }
      toast.success('Processo atualizado!')
      router.push(`/processos/${id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-zinc-500">
          <Link href={`/processos/${id}`}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao processo
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Editar processo</h1>
        <p className="text-sm text-zinc-500">Altere nome, datas, valor e os campos do formulário. Quem já enviou o formulário mantém os dados originais.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identificação do processo</CardTitle>
              <CardDescription>A data de referência é o "evento": a edição do formulário pela pessoa é bloqueada a 3 dias dela.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do processo *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ref">Data de referência (evento) *</Label>
                <Input id="ref" type="date" value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor da cobrança (R$)</Label>
                  <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1500,00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due">Vencimento</Label>
                  <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição da cobrança (aparece no Asaas)</Label>
                <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campos do formulário</CardTitle>
              <CardDescription>
                Vale para novos envios de formulário. Nome, CPF e e-mail são sempre coletados. Quem já preencheu mantém os dados antigos mesmo se você desligar o campo aqui.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {ALL_FIELDS.map((f) => (
                  <li key={f.key}>
                    <label className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${f.toggleable ? 'cursor-pointer hover:bg-zinc-50' : 'opacity-80'}`}>
                      <Checkbox checked={enabled.includes(f.key)} onCheckedChange={() => toggleField(f.key, f.toggleable)} disabled={!f.toggleable} />
                      <span>{f.label}</span>
                      {!f.toggleable && <span className="ml-auto text-[10px] text-zinc-400">fixo</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href={`/processos/${id}`}>Cancelar</Link>
            </Button>
          </div>
        </form>
      )}
    </AdminShell>
  )
}
