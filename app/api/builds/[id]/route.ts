import { NextResponse } from 'next/server'
import { getBuildById, deleteBuild } from '@/lib/data/builds'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const build = await getBuildById(id)

  if (!build) {
    return NextResponse.json({ error: 'Build not found' }, { status: 404 })
  }

  return NextResponse.json(build)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const deleted = await deleteBuild(id)

  if (!deleted) {
    return NextResponse.json({ error: 'Build not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
