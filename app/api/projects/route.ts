import { NextResponse } from 'next/server'
import { getAllProjects, createProject } from '@/lib/data/projects'
import { requireApiSession } from '@/lib/auth/api'

export async function GET() {
  const unauthorized = await requireApiSession()
  if (unauthorized) return unauthorized

  const projects = await getAllProjects()
  return NextResponse.json(projects)
}

export async function POST(request: Request) {
  const unauthorized = await requireApiSession()
  if (unauthorized) return unauthorized

  const body = await request.json()

  if (!body.name || !body.path || !body.buildCommand) {
    return NextResponse.json(
      { error: 'Missing required fields: name, path, buildCommand' },
      { status: 400 },
    )
  }

  const project = await createProject({
    name: body.name,
    path: body.path,
    buildCommand: body.buildCommand,
    gitPullBeforeBuild: body.gitPullBeforeBuild,
    outputPaths: body.outputPaths,
    gitCredentialId: body.gitCredentialId,
  })

  return NextResponse.json(project, { status: 201 })
}
