'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileText, Save, Plus } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { TEMPLATE_VARIABLES } from '@/lib/fields'

export default function ModeloPage() {
  const [template, setTemplate] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/admin/template')
      const data = await res.json()
      setTemplate(data.template || '')
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      })
      const data = await res.json()
      if (res.ok) toast.success('Modelo salvo!')
      else toast.error(data.error || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const insertVariable = (key: string) => {
    if (template === null) return
    setTemplate(`${template}{{${key}}}`)
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6 text-emerald-600" /> Modelo do contrato
        </h1>
        <p className="text-sm text-zinc-500">
          Texto gerado em PDF após o preenchimento do formulário. Use variáveis entre chaves duplas — são substituídas pelos dados de cada pessoa.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Texto do contrato</CardTitle>
            <CardDescription>O bloco de assinaturas (cliente + administrador) e a lista de dados declarados são adicionados automaticamente ao final do PDF.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {template === null ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <Textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={22} className="font-mono text-xs leading-relaxed" />
            )}
            <Button onClick={save} disabled={saving || template === null}>
              <Save className="mr-1.5 h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar modelo'}
            </Button>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Variáveis disponíveis</CardTitle>
            <CardDescription>Clique para inserir no final do texto.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <li key={v.key}>
                  <button
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="inline-flex items-center gap-1 rounded-full border bg-zinc-50 px-2.5 py-1 text-xs hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                    title={`Inserir {{${v.key}}}`}
                  >
                    <Plus className="h-3 w-3" /> <code>{`{{${v.key}}}`}</code>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-md bg-zinc-50 border p-3 text-xs text-zinc-500 space-y-1">
              <p><code className="text-zinc-800">{'{{rg_campo}}'}</code>, <code className="text-zinc-800">{'{{telefone_campo}}'}</code> e <code className="text-zinc-800">{'{{nascimento_campo}}'}</code> são auxiliares: viram texto apenas se a pessoa preencheu o campo.</p>
              <p>Variável vazia vira <code className="text-zinc-800">____________</code> no PDF.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
