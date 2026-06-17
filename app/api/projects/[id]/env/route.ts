import { NextResponse } from 'next/server'
import { getProjectById } from '@/lib/data/projects'
import { getEnvVars, setEnvVars } from '@/lib/data/env-vars'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = await getProjectById(id)
  if (!project)
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const vars = await getEnvVars(id)
  return NextResponse.json(vars)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = await getProjectById(id)
  if (!project)
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const body = await request.json()
  const vars: { key: string; value: string }[] = body.vars

  if (!Array.isArray(vars)) {
    return NextResponse.json({ error: 'Invalid vars format' }, { status: 400 })
  }

  const validVars = vars.filter((v) => v.key.trim().length > 0)

  try {
    await setEnvVars(id, validVars)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Failed to save environment variables' },
      { status: 500 },
    )
  }
}
