import { NextResponse } from 'next/server'
import {
  deleteWebhook,
  getWebhookById,
  updateWebhook,
} from '@/lib/data/webhooks'
import { getProjectById } from '@/lib/data/projects'
import {
  handleWebhookDelivery,
  verifyWebhookRequest,
} from '@/lib/webhooks/handler'
import { requireApiSession } from '@/lib/auth/api'

export const runtime = 'nodejs'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const webhook = await getWebhookById(id)

  if (!webhook || !webhook.enabled) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
  }

  const rawBody = Buffer.from(await request.arrayBuffer())

  if (!verifyWebhookRequest(webhook, rawBody, request.headers)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    const result = await handleWebhookDelivery(
      webhook,
      request.headers,
      rawBody,
    )

    return NextResponse.json(result, { status: result.ignored ? 202 : 201 })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 },
      )
    }

    if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (error instanceof Error && error.message === 'BUILD_QUEUE_FULL') {
      return NextResponse.json(
        { error: 'Build queue is full, please try again later' },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireApiSession()
  if (unauthorized) return unauthorized

  const { id } = await params
  const body = await request.json().catch(() => null)

  try {
    if (body?.projectId !== undefined) {
      const project = await getProjectById(body.projectId)
      if (!project) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 },
        )
      }
    }

    const webhook = await updateWebhook(id, {
      name: body?.name,
      provider: body?.provider,
      projectId: body?.projectId,
      secret: body?.secret,
      branch: body?.branch,
      enabled: body?.enabled,
    })

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    return NextResponse.json(webhook)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid webhook.' },
      { status: 400 },
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireApiSession()
  if (unauthorized) return unauthorized

  const { id } = await params
  const deleted = await deleteWebhook(id)

  if (!deleted) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
