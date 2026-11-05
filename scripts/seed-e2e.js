/* Cria admin de teste no DB de teste (para login via HTTP). */
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const path = require('path')

const dbPath = (process.env.E2E_DB || path.join(__dirname, '..', 'db', 'test-run.db')).replace(/\\/g, '/')
const db = new PrismaClient({ datasources: { db: { url: 'file:' + dbPath } } })

async function main() {
  const hash = await bcrypt.hash('SenhaTeste123!', 10)
  const existing = await db.user.findUnique({ where: { email: 'e2e@test.local' } })
  if (!existing) {
    await db.user.create({ data: { email: 'e2e@test.local', name: 'E2E', passwordHash: hash } })
  }
  // alvo do teste de webhook forjado
  let proc = await db.process.findFirst({ where: { name: 'E2E-WEBHOOK' } })
  if (!proc) {
    proc = await db.process.create({ data: { name: 'E2E-WEBHOOK', referenceDate: '2026-11-04', formFields: '[]' } })
  }
  let target = await db.recipient.findFirst({ where: { email: 'wh@test.local' } })
  if (!target) {
    target = await db.recipient.create({
      data: { processId: proc.id, name: 'Webhook Test', email: 'wh@test.local', status: 'pagamento_enviado', asaasPaymentId: 'pay_fake_e2e_123', paymentUrl: 'https://example.com/pay' },
    })
  }
  console.log(JSON.stringify({ ok: true, webhookTarget: { id: target.id, payment: target.asaasPaymentId, status: target.status } }))
  await db.$disconnect()
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
