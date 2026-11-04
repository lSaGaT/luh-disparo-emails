'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, FileText, Settings2, LogOut, FolderKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/', label: 'Painel', icon: LayoutDashboard },
  { href: '/processos', label: 'Processos', icon: FolderKanban },
  { href: '/modelo', label: 'Modelo do contrato', icon: FileText },
  { href: '/configuracoes', label: 'Configurações', icon: Settings2 },
]

export function AdminShell({
  children,
  userName,
}: {
  children: React.ReactNode
  userName?: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  // mantém a fila rodando enquanto o painel está aberto
  useEffect(() => {
    const ping = () => {
      void fetch('/api/admin/queue/tick', { method: 'POST' }).catch(() => undefined)
    }
    ping()
    const timer = setInterval(ping, 6000)
    return () => clearInterval(timer)
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <header className="sticky top-0 z-30 border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-zinc-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm">CD</span>
            <span className="hidden sm:inline">Central de Documentos</span>
          </Link>
          <nav className="ml-auto hidden md:flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
                  (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)) &&
                    'bg-zinc-100 text-zinc-900 font-medium'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto md:ml-0 flex items-center gap-2">
            {userName && <span className="hidden sm:inline text-sm text-zinc-500">{userName}</span>}
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sair" title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* navegação mobile */}
      <nav className="md:hidden border-b bg-white px-2 py-2 flex items-center gap-1 overflow-x-auto">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-zinc-600',
              (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)) &&
                'bg-zinc-100 text-zinc-900 font-medium'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">{children}</main>

      <footer className="mt-auto border-t bg-white py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-6xl px-4 text-xs text-zinc-400">
          Central de Documentos — formulários por e-mail, contratos com assinatura eletrônica (Autentique) e cobrança via Asaas.
        </div>
      </footer>
    </div>
  )
}
