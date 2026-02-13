import { NextResponse } from 'next/server'
import {
  getProjectById,
  updateProject,
  deleteProject,
} from '@/lib/data/projects'
import { deleteProjectBuilds } from '@/lib/data/builds'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = await getProjectById(id)

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  return NextResponse.json(project)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json()

  const project = await updateProject(id, {
    name: body.name,
    path: body.path,
    buildCommand: body.buildCommand,
    gitPullBeforeBuild: body.gitPullBeforeBuild,
    outputPaths: body.outputPaths,
    gitCredentialId: body.gitCredentialId,
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  return NextResponse.json(project)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  await deleteProjectBuilds(id)
  const deleted = await deleteProject(id)

  if (!deleted) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
