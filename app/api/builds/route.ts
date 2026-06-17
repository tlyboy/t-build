import { NextResponse } from 'next/server'
import {
  getAllBuilds,
  getBuildsByProjectId,
  createBuild,
} from '@/lib/data/builds'
import { getProjectById } from '@/lib/data/projects'
import { enqueueBuild } from '@/lib/build-executor'
import { updateBuild } from '@/lib/data/builds'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')

  if (projectId) {
    const builds = await getBuildsByProjectId(projectId)
    return NextResponse.json(builds)
  }

  const builds = await getAllBuilds()
  return NextResponse.json(builds)
}

export async function POST(request: Request) {
  const body = await request.json()

  if (!body.projectId) {
    return NextResponse.json(
      { error: 'Missing required field: projectId' },
      { status: 400 },
    )
  }

  const project = await getProjectById(body.projectId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const build = await createBuild(body.projectId)

  try {
    enqueueBuild(build.id)
  } catch {
    await updateBuild(build.id, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
    })
    return NextResponse.json(
      { error: 'Build queue is full, please try again later' },
      { status: 503 },
    )
  }

  return NextResponse.json(build, { status: 201 })
}
