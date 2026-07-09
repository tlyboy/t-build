import crypto from 'crypto'
import { createBuild, updateBuild } from '@/lib/data/builds'
import { getProjectById } from '@/lib/data/projects'
import { WebhookConfig, recordWebhookTrigger } from '@/lib/data/webhooks'
import { enqueueBuild } from '@/lib/build-executor'

interface WebhookDelivery {
  event: string
  branch?: string
  ignored?: string
}

function safeEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value)
  const expectedBuffer = Buffer.from(expected)

  return (
    valueBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(valueBuffer, expectedBuffer)
  )
}

function verifyGithubSignature(
  rawBody: Buffer,
  secret: string,
  signature: string | null,
) {
  if (!signature?.startsWith('sha256=')) return false

  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')}`

  return safeEqual(signature, expected)
}

function verifyCodeupToken(secret: string, token: string | null) {
  if (!token) return false
  return safeEqual(token, secret)
}

function branchFromRef(ref?: unknown) {
  if (typeof ref !== 'string') return undefined
  return ref.replace(/^refs\/heads\//, '')
}

function parseGithubDelivery(
  headers: Headers,
  payload: Record<string, unknown>,
): WebhookDelivery {
  const event = headers.get('x-github-event') ?? ''

  if (event === 'ping') {
    return { event, ignored: 'ping' }
  }

  if (event !== 'push') {
    return { event, ignored: 'unsupported_event' }
  }

  if (
    payload.deleted === true ||
    payload.after === '0000000000000000000000000000000000000000'
  ) {
    return { event, ignored: 'deleted_ref' }
  }

  return {
    event,
    branch: branchFromRef(payload.ref),
  }
}

function parseCodeupDelivery(
  headers: Headers,
  payload: Record<string, unknown>,
): WebhookDelivery {
  const event =
    headers.get('codeup-event') ??
    headers.get('x-codeup-event') ??
    String(payload.object_kind ?? '')

  if (!event.toLowerCase().includes('push')) {
    return { event, ignored: 'unsupported_event' }
  }

  if (payload.after === '0000000000000000000000000000000000000000') {
    return { event, ignored: 'deleted_ref' }
  }

  return {
    event,
    branch: branchFromRef(payload.ref ?? payload.branch),
  }
}

function parseDelivery(
  webhook: WebhookConfig,
  headers: Headers,
  payload: Record<string, unknown>,
) {
  if (webhook.provider === 'github') {
    return parseGithubDelivery(headers, payload)
  }

  return parseCodeupDelivery(headers, payload)
}

export function verifyWebhookRequest(
  webhook: WebhookConfig,
  rawBody: Buffer,
  headers: Headers,
) {
  if (webhook.provider === 'github') {
    return verifyGithubSignature(
      rawBody,
      webhook.secret,
      headers.get('x-hub-signature-256'),
    )
  }

  return verifyCodeupToken(webhook.secret, headers.get('x-codeup-token'))
}

export async function handleWebhookDelivery(
  webhook: WebhookConfig,
  headers: Headers,
  rawBody: Buffer,
) {
  const payload = JSON.parse(rawBody.toString('utf-8')) as Record<
    string,
    unknown
  >
  const delivery = parseDelivery(webhook, headers, payload)

  if (delivery.ignored) {
    return {
      ignored: true,
      reason: delivery.ignored,
      event: delivery.event,
    }
  }

  if (webhook.branch && webhook.branch !== delivery.branch) {
    return {
      ignored: true,
      reason: 'branch_mismatch',
      event: delivery.event,
      branch: delivery.branch,
    }
  }

  const project = await getProjectById(webhook.projectId)
  if (!project) {
    throw new Error('PROJECT_NOT_FOUND')
  }

  const build = await createBuild(project.id)

  try {
    enqueueBuild(build.id)
  } catch {
    await updateBuild(build.id, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
    })
    throw new Error('BUILD_QUEUE_FULL')
  }

  await recordWebhookTrigger(webhook.id, build.id)

  return {
    ignored: false,
    event: delivery.event,
    branch: delivery.branch,
    build,
  }
}
