import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { retryRecipient } from '@/lib/pipeline'

export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const { id } = await ctx.params
  const result = await retryRecipient(id)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
