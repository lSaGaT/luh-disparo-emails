const { PrismaClient } = require('@prisma/client')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'db', 'test-run.db').replace(/\\/g, '/')
const p = new PrismaClient({ datasources: { db: { url: 'file:' + dbPath } } })

p.$queryRawUnsafe('PRAGMA table_info(User)')
  .then((cols) => {
    console.log('Colunas User:', cols.map((c) => c.name).join(', '))
    return p.$disconnect()
  })
  .catch((e) => {
    console.error('ERRO:', e.message)
    process.exit(1)
  })
