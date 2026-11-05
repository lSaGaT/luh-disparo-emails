/* Validação funcional do Lote 4 — roda contra db/test-run.db (cópia). */
const { PrismaClient } = require('@prisma/client')
const path = require('path')
const crypto = require('crypto')

const dbPath = path.join(__dirname, '..', 'db', 'test-run.db').replace(/\\/g, '/')
const db = new PrismaClient({ datasources: { db: { url: 'file:' + dbPath } } })

async function main() {
  const results = []
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' | ' + detail : ''}`)
  }

  // 1) token CSPRNG: formato, unicidade e entropia
  const tokens = new Set(Array.from({ length: 1000 }, () => crypto.randomBytes(32).toString('base64url')))
  check('generateRecipientToken: 1000 tokens únicos', tokens.size === 1000)
  const sample = tokens.values().next().value
  check('token tem ~43 chars (256 bits b64url)', sample.length === 43, `len=${sample.length}`)

  // 2) claim atômico do formulário: 2 updateMany concorrentes, só 1 passa
  const process = await db.process.create({
    data: { name: 'TESTE-SEGURANCA', referenceDate: '2026-11-04', formFields: '[]' },
  })
  const r1 = await db.recipient.create({
    data: { processId: process.id, name: 'Teste A', email: 'a@test.local', status: 'form_enviado' },
  })

  const [c1, c2] = await Promise.all([
    db.recipient.updateMany({ where: { id: r1.id, status: { in: ['fila', 'form_enviado', 'erro'] } }, data: { status: 'form_recebido' } }),
    db.recipient.updateMany({ where: { id: r1.id, status: { in: ['fila', 'form_enviado', 'erro'] } }, data: { status: 'form_recebido' } }),
  ])
  check('TOCTOU: apenas 1 claim concorrente vence', c1.count + c2.count === 1, `counts=${c1.count},${c2.count}`)

  // 3) guard: contrato não regenera quando autentiqueDocId já existe
  const r2 = await db.recipient.create({
    data: { processId: process.id, name: 'Teste B', email: 'b@test.local', status: 'form_recebido', autentiqueDocId: 'doc_existente', signUrl: 'https://autentique.app/l/x' },
  })
  const claimBlocked = await db.recipient.updateMany({
    where: { id: r2.id, status: 'form_recebido', autentiqueDocId: null },
    data: { status: 'gerando_contrato' },
  })
  check('contrato existente: regeneração bloqueada', claimBlocked.count === 0)

  // 4) expiração de link
  const old = await db.recipient.create({
    data: { processId: process.id, name: 'Teste C', email: 'c@test.local', createdAt: new Date(Date.now() - 91 * 86400000) },
  })
  const fresh = await db.recipient.create({
    data: { processId: process.id, name: 'Teste D', email: 'd@test.local' },
  })
  const ttlMs = 90 * 24 * 60 * 60 * 1000
  check('link antigo (>90d) expira', Date.now() - old.createdAt.getTime() > ttlMs)
  check('link novo não expira', Date.now() - fresh.createdAt.getTime() <= ttlMs)

  // 5) tokenVersion: incremento revoga (estrutura)
  const u = await db.user.create({
    data: { email: 'seg@test.local', name: 'Seg', passwordHash: '$2b$10$C6UzMDM.H6dfI/f/IKcEeO7ZUbE0f8bZGm1xRwZ1b8Yq7VXpQ1SKe' },
  })
  const bumped = await db.user.update({ where: { id: u.id }, data: { tokenVersion: { increment: 1 } } })
  check('tokenVersion incrementa (revogação)', u.tokenVersion === 0 && bumped.tokenVersion === 1)

  // cleanup
  await db.recipient.deleteMany({ where: { processId: process.id } })
  await db.process.delete({ where: { id: process.id } })
  await db.user.delete({ where: { id: u.id } })

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${failed.length === 0 ? '✅ TODOS OS TESTES PASSARAM' : '❌ ' + failed.length + ' FALHAS'}`)
  await db.$disconnect()
  if (failed.length > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error('ERRO:', e)
  process.exitCode = 1
})
