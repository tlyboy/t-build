import { NextResponse } from 'next/server'
import { getBuildById } from '@/lib/data/builds'
import { cancelBuild } from '@/lib/build-executor'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const build = await getBuildById(id)

  if (!build) {
    return NextResponse.json({ error: 'Build not found' }, { status: 404 })
  }

  const cancelled = cancelBuild(id)
  return NextResponse.json({ cancelled })
}
