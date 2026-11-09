export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureQueueInterval, catchUp } = await import('./lib/queue')
    ensureQueueInterval()
    // captura de abertura ("varredura do que rolou desligado"): adiada porque
    // o register precisa terminar antes do servidor aceitar requisições
    setTimeout(() => {
      void catchUp().catch((e: unknown) =>
        console.error('[fila] captura de abertura falhou:', e instanceof Error ? e.message : e)
      )
    }, 10_000)
  }
}
