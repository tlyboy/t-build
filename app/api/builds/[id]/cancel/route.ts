import { NextResponse } from 'next/server'
import { getBuildById } from '@/lib/data/builds'
import { cancelBuild } from '@/lib/build-executor'
import { requireApiSession } from '@/lib/auth/api'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireApiSession()
  if (unauthorized) return unauthorized

  const { id } = await params
  const build = await getBuildById(id)

  if (!build) {
    return NextResponse.json({ error: 'Build not found' }, { status: 404 })
  }

  const cancelled = cancelBuild(id)
  return NextResponse.json({ cancelled })
}
