import { NextResponse } from 'next/server'
import { getSafeSettings, updateSettings } from '@/lib/data/settings'

export async function GET() {
  const settings = await getSafeSettings()
  return NextResponse.json(settings)
}

export async function PUT(request: Request) {
  const body = await request.json()

  const updated = await updateSettings({
    workDir: body.workDir,
  })

  return NextResponse.json({
    workDir: updated.workDir,
  })
}
