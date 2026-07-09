import { NextResponse } from 'next/server'
import { deleteGitCredential } from '@/lib/data/settings'
import { requireApiSession } from '@/lib/auth/api'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireApiSession()
  if (unauthorized) return unauthorized

  const { id } = await params
  const deleted = await deleteGitCredential(id)

  if (!deleted) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
