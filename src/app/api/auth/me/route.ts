import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  const user = await getSessionUser()
  if (user) {
    return NextResponse.json({ user, needsSetup: false })
  }
  const count = await db.user.count()
  return NextResponse.json({ user: null, needsSetup: count === 0 })
}
