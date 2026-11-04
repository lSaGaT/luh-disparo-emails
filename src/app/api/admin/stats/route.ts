import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/api-auth'

export async function GET() {
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const [processes, totalProcesses, statusGroups, lastEmails, lastTick] = await Promise.all([
    db.process.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { _count: { select: { recipients: true } } } }),
    db.process.count(),
    db.recipient.groupBy({ by: ['status'], _count: { _all: true } }),
    db.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    Promise.resolve(null),
  ])

  const byStatus: Record<string, number> = {}
  for (const g of statusGroups) byStatus[g.status] = g._count._all

  return NextResponse.json({
    totalProcesses,
    totalRecipients: statusGroups.reduce((acc, g) => acc + g._count._all, 0),
    byStatus,
    recentProcesses: processes,
    lastEmails,
  })
}
