import { NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/auth/server'

export async function requireApiSession() {
  const session = await getCurrentSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
