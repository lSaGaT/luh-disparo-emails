/** Layout das páginas públicas (formulário e status). Vive fora do diretório
 * de páginas: arquivos em app/ só podem exportar default + metadados. */
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
