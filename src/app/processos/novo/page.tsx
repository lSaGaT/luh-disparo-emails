'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload } from 'lucide-react'
import Link from 'next/link'
import { AdminShell } from '@/components/admin-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ALL_FIELDS, DEFAULT_ENABLED_FIELDS } from '@/lib/fields'

export default function NovoProcessoPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [referenceDate, setReferenceDate] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [emails, setEmails] = useState('')
  const [enabled, setEnabled] = useState<string[]>(DEFAULT_ENABLED_FIELDS)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const toggleField = (key: string, toggleable: boolean) => {
    if (!toggleable) return
    setEnabled((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/admin/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          referenceDate,
          amount: amount ? Number(amount.replace(',', '.')) : null,
          dueDate: dueDate || null,
          description: description || null,
          emails,
          formFields: enabled,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Não foi possível criar o processo.')
        return
      }
      router.push(`/processos/${data.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-zinc-500">
          <Link href="/processos">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar aos processos
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Novo envio em massa</h1>
        <p className="text-sm text-zinc-500">Dê um nome e uma data para referenciar o processo, escolha os campos do formulário e cole a lista de e-mails.</p>
      </div>

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identificação do processo</CardTitle>
            <CardDescription>Use o nome e a data para localizar este envio depois.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do processo *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Contratos Condomínio Vista Alegre" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref">Data de referência *</Label>
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
              <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Taxa de adesão — contrato nº {{ref}}" />
            </div>
            <p className="text-xs text-zinc-400">Deixe o valor vazio para criar os processos sem cobrança (o link de pagamento só será gerado se houver valor).</p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campos do formulário</CardTitle>
              <CardDescription>Escolha quais informações a pessoa vai preencher. Nome, CPF e e-mail são sempre coletados.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {ALL_FIELDS.map((f) => (
                  <li key={f.key}>
                    <label className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${f.toggleable ? 'cursor-pointer hover:bg-zinc-50' : 'opacity-80'}`}>
                      <Checkbox
                        checked={enabled.includes(f.key)}
                        onCheckedChange={() => toggleField(f.key, f.toggleable)}
                        disabled={!f.toggleable}
                      />
                      <span>{f.label}</span>
                      {!f.toggleable && <span className="ml-auto text-[10px] text-zinc-400">fixo</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4 text-emerald-600" /> Lista de e-mails
              </CardTitle>
              <CardDescription>Uma pessoa por linha: <code className="text-xs bg-zinc-100 px-1 rounded">Nome;email@dominio.com</code> (ou só o e-mail).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                rows={8}
                placeholder={'Maria Souza;maria@email.com\nJoão Santos;john@email.com\nana@email.com'}
              />
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Criando…' : 'Criar processo com a lista'}
                </Button>
                <span className="text-xs text-zinc-400">
                  {emails.split(/\r?\n/).filter((l) => /.+@.+\..+/.test(l.trim())).length} e-mail(s) válido(s) detectado(s)
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </AdminShell>
  )
}
