import { NextResponse } from 'next/server'
import { getAllProjects, getProjectById } from '@/lib/data/projects'
import { createWebhook, getSafeWebhooks } from '@/lib/data/webhooks'
import { requireApiSession } from '@/lib/auth/api'

export async function GET() {
  const unauthorized = await requireApiSession()
  if (unauthorized) return unauthorized

  const [webhooks, projects] = await Promise.all([
    getSafeWebhooks(),
    getAllProjects(),
  ])

  return NextResponse.json({
    webhooks,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
    })),
  })
}

export async function POST(request: Request) {
  const unauthorized = await requireApiSession()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => null)

  try {
    const project = await getProjectById(body?.projectId ?? '')
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const webhook = await createWebhook({
      id: body?.id,
      name: body?.name ?? '',
      provider: body?.provider,
      projectId: body?.projectId ?? '',
      secret: body?.secret ?? '',
      branch: body?.branch,
      enabled: body?.enabled,
    })

    return NextResponse.json(webhook, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid webhook.' },
      { status: 400 },
    )
  }
}
