import { NextResponse } from 'next/server'
import { getSafeSettings, updateSettings } from '@/lib/data/settings'
import { requireApiSession } from '@/lib/auth/api'

export async function GET() {
  const unauthorized = await requireApiSession()
  if (unauthorized) return unauthorized

  const settings = await getSafeSettings()
  return NextResponse.json(settings)
}

export async function PUT(request: Request) {
  const unauthorized = await requireApiSession()
  if (unauthorized) return unauthorized

  const body = await request.json()

  const updated = await updateSettings({
    workDir: body.workDir,
  })

  return NextResponse.json({
    workDir: updated.workDir,
  })
}
