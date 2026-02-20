import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import {
  getProjectById,
  updateProject,
  deleteProject,
} from '@/lib/data/projects'
import { deleteProjectBuilds } from '@/lib/data/builds'
import { getSettings } from '@/lib/data/settings'

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

  const project = await getProjectById(id)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  await deleteProjectBuilds(id)
  await deleteProject(id)

  // Delete project directory on disk if inside workDir
  if (project.path && !path.isAbsolute(project.path)) {
    const settings = await getSettings()
    if (settings.workDir) {
      const projectDir = path.join(settings.workDir, project.path)
      if (projectDir.startsWith(settings.workDir)) {
        await fs
          .rm(projectDir, { recursive: true, force: true })
          .catch(() => {})
      }
    }
  }

  return NextResponse.json({ success: true })
}
