'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function LoginPage() {
  const router = useRouter()
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (data.user) {
        router.replace('/')
        return
      }
      setNeedsSetup(data.needsSetup)
    })()
  }, [router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const url = needsSetup ? '/api/auth/setup' : '/api/auth/login'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(needsSetup ? { name, email, password } : { email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Não foi possível entrar.')
        return
      }
      router.replace('/')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold">CD</span>
            <span className="font-semibold text-lg text-zinc-900">Central de Documentos</span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{needsSetup === null ? 'Carregando…' : needsSetup ? 'Criar acesso do administrador' : 'Entrar no painel'}</CardTitle>
              <CardDescription>
                {needsSetup
                  ? 'Este é o primeiro acesso. Defina o login do dono do sistema.'
                  : 'Acesse com o e-mail e a senha do administrador.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {needsSetup === null ? (
                <p className="text-sm text-zinc-500">Verificando…</p>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  {needsSetup && (
                    <div className="space-y-2">
                      <Label htmlFor="name">Seu nome</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do administrador" required />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required autoComplete="username" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required autoComplete={needsSetup ? 'new-password' : 'current-password'} minLength={6} />
                  </div>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Aguarde…' : needsSetup ? 'Criar acesso e entrar' : 'Entrar'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <footer className="py-4 text-center text-xs text-zinc-400">
        Formulários por e-mail · Contratos com assinatura eletrônica · Cobranças via link
      </footer>
    </div>
  )
}
