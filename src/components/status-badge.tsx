'use client'

import { Badge } from '@/components/ui/badge'
import { statusMeta } from '@/lib/status'

export function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status)
  return (
    <Badge variant="outline" className={`${meta.tone} whitespace-nowrap`}>
      {meta.label}
    </Badge>
  )
}
