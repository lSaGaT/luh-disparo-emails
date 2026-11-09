'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Mail, PenTool, Wallet, Globe2, Save, SendHorizonal, PlugZap, KeyRound, Copy } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

type Settings = {
  smtpHost: string
  smtpPort: number
  smtpUser: string | null
  smtpPass: string | null
  smtpFromName: string
  autentiqueToken: string | null
  autentiqueWebhookSecret: string | null
  adminSignerName: string | null
  adminSignerEmail: string | null
  adminSignerCpf: string | null
  asaasApiKey: string | null
  asaasEnv: string
  appUrl: string | null
  queueDelaySeconds: number
  pollMinutes: number
  contractTemplate: string
}

export default function ConfiguracoesPage() {
  const [s, setS] = useState<Settings | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' })
      const data = await res.json()
      setS(data.settings)
      setTestEmail(data.settings?.smtpUser || '')
    })()
  }, [])

  const set = (patch: Partial<Settings>) => {
    setS((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const save = async () => {
    if (!s) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      })
      const data = await res.json()
      if (res.ok) toast.success('Configurações salvas!')
      else toast.error(data.error || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const runTest = async (kind: 'email' | 'autentique' | 'asaas') => {
    const res = await fetch(`/api/admin/settings/test-${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testEmail }),
    })
    const data = await res.json()
    if (res.ok && data.ok) toast.success(kind === 'email' ? 'E-mail de teste enviado!' : 'Conexão OK!')
    else toast.error(data.error || 'Falha no teste.')
  }

  const changePassword = async () => {
    const res = await fetch('/api/admin/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Senha alterada!')
      setCurrentPassword('')
      setNewPassword('')
    } else {
      toast.error(data.error || 'Não foi possível alterar a senha.')
    }
  }

  return (
    <AdminShell>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
          <p className="text-sm text-zinc-500">Conecte o Gmail (SMTP), a Autentique e o Asaas. Nenhum disparo funciona sem estas credenciais.</p>
        </div>
        <Button onClick={save} disabled={saving || !s} className="sm:ml-auto">
          <Save className="mr-1.5 h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar tudo'}
        </Button>
      </div>

      {!s ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-600" /> Gmail (SMTP) — disparo de e-mails</CardTitle>
              <CardDescription>
                Use uma <strong>senha de app</strong> do Google: myaccount.google.com → Segurança → Verificação em duas etapas → Senhas de app. Porta padrão 465.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtpUser">E-mail do Gmail</Label>
                <Input id="smtpUser" value={s.smtpUser || ''} onChange={(e) => set({ smtpUser: e.target.value })} placeholder="seuemail@gmail.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPass">Senha de app (16 caracteres)</Label>
                <Input id="smtpPass" type="password" value={s.smtpPass || ''} onChange={(e) => set({ smtpPass: e.target.value })} placeholder="xxxx xxxx xxxx xxxx" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpHost">Servidor SMTP</Label>
                <Input id="smtpHost" value={s.smtpHost} onChange={(e) => set({ smtpHost: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPort">Porta</Label>
                <Input id="smtpPort" type="number" value={s.smtpPort} onChange={(e) => set({ smtpPort: Number(e.target.value) })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="smtpFromName">Nome do remetente (aparece nos e-mails)</Label>
                <Input id="smtpFromName" value={s.smtpFromName} onChange={(e) => set({ smtpFromName: e.target.value })} />
              </div>
              <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="testEmail">Enviar e-mail de teste para</Label>
                  <Input id="testEmail" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="voce@email.com" />
                </div>
                <Button variant="outline" onClick={() => runTest('email')}>
                  <SendHorizonal className="mr-1.5 h-4 w-4" /> Testar envio
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><PenTool className="h-4 w-4 text-emerald-600" /> Autentique — assinatura eletrônica</CardTitle>
              <CardDescription>
                Gere o token em autentique.com.br → Minha conta → API. Este token assina automaticamente como você (2ª assinatura).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="autentiqueToken">Token da API</Label>
                <Input id="autentiqueToken" type="password" value={s.autentiqueToken || ''} onChange={(e) => set({ autentiqueToken: e.target.value })} placeholder="Token de API (sandbox ou produção)" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="autentiqueWebhookSecret">Segredos do webhook (HMAC) — um por webhook</Label>
                <Input id="autentiqueWebhookSecret" type="password" value={s.autentiqueWebhookSecret || ''} onChange={(e) => set({ autentiqueWebhookSecret: e.target.value })} placeholder="Cole aqui TODOS os códigos gerados no painel, separados por vírgula" />
                <p className="text-xs text-zinc-500">
                  Cada webhook criado no painel (Conta → Webhooks) gera um código próprio. Cole todos neste campo, separados por vírgula (ex.: CODIGO1,CODIGO2) — qualquer entrega assinada por um deles é aceita. Enquanto estiver vazio, o webhook continua funcionando (a rota reconfirma pela API antes de agir).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminSignerName">Seu nome (2º signatário)</Label>
                <Input id="adminSignerName" value={s.adminSignerName || ''} onChange={(e) => set({ adminSignerName: e.target.value })} placeholder="Nome que aparece no contrato" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminSignerEmail">Seu e-mail (conta Autentique)</Label>
                <Input id="adminSignerEmail" type="email" value={s.adminSignerEmail || ''} onChange={(e) => set({ adminSignerEmail: e.target.value })} placeholder="Deve ser o mesmo e-mail da conta do token" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminSignerCpf">Seu CPF (opcional)</Label>
                <Input id="adminSignerCpf" value={s.adminSignerCpf || ''} onChange={(e) => set({ adminSignerCpf: e.target.value })} placeholder="000.000.000-00" />
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={() => runTest('autentique')}>
                  <PlugZap className="mr-1.5 h-4 w-4" /> Testar conexão
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4 text-emerald-600" /> Asaas — link de pagamento</CardTitle>
              <CardDescription>Crie a API key em asaas.com → Configurações → Integrações. No modo sandbox as cobranças são de teste.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="asaasApiKey">API key</Label>
                <Input id="asaasApiKey" type="password" value={s.asaasApiKey || ''} onChange={(e) => set({ asaasApiKey: e.target.value })} placeholder="$aact_..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asaasEnv">Ambiente</Label>
                <Select value={s.asaasEnv} onValueChange={(v) => set({ asaasEnv: v })}>
                  <SelectTrigger id="asaasEnv"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button variant="outline" onClick={() => runTest('asaas')}>
                  <PlugZap className="mr-1.5 h-4 w-4" /> Testar conexão
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Globe2 className="h-4 w-4 text-emerald-600" /> Geral</CardTitle>
              <CardDescription>
                Endereço público onde este sistema roda — usado nos links dos e-mails (formulário, assinatura, 2ª via). Em produção, informe algo como https://meusistema.com.br.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="appUrl">URL pública do sistema</Label>
                <Input id="appUrl" value={s.appUrl || ''} onChange={(e) => set({ appUrl: e.target.value })} placeholder="https://meusistema.com.br" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="queueDelay">Intervalo entre disparos (segundos)</Label>
                <Input id="queueDelay" type="number" min={5} value={s.queueDelaySeconds} onChange={(e) => set({ queueDelaySeconds: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pollMinutes">Sondagem de status (minutos)</Label>
                <Input id="pollMinutes" type="number" min={1} value={s.pollMinutes} onChange={(e) => set({ pollMinutes: Number(e.target.value) })} />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <p className="text-xs text-zinc-500">
                  <strong>Webhooks</strong> (opcional, detecção em segundos em vez de esperar a sondagem): cadastre as URLs abaixo no painel da Autentique (Conta → Webhooks) e do Asaas (Configurações → Integrações). Essas APIs não permitem cadastrar webhook automaticamente — o cadastro é manual nos painéis deles.
                </p>
                {(['autentique', 'asaas'] as const).map((svc) => {
                  const url = `${(s.appUrl || 'http://localhost:3000').replace(/\/$/, '')}/api/webhooks/${svc}`
                  return (
                    <div key={svc} className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded bg-zinc-100 px-2 py-1.5 text-xs">{url}</code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(url)
                            toast.success(`URL do ${svc} copiada!`)
                          } catch {
                            toast.error('Não foi possível copiar.')
                          }
                        }}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
                      </Button>
                    </div>
                  )
                })}
                <p className="text-xs text-zinc-400">As URLs usam a "URL pública do sistema" acima — salve-a antes de copiar.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4 text-emerald-600" /> Alterar senha do administrador</CardTitle>
              <CardDescription>Troque a senha que você usa para entrar no painel.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Senha atual</Label>
                <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova senha (mín. 6 caracteres)</Label>
                <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div>
                <Button variant="outline" onClick={changePassword} disabled={!currentPassword || newPassword.length < 6}>
                  Alterar senha
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator />
        </div>
      )}
    </AdminShell>
  )
}
