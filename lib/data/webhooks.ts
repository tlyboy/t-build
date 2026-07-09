import { decrypt, encrypt, isEncrypted } from '@/lib/crypto'
import { getBusinessDatabase } from '@/lib/db/business'

export type WebhookProvider = 'github' | 'codeup'

export interface WebhookConfig {
  id: string
  name: string
  provider: WebhookProvider
  projectId: string
  secret: string
  branch?: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  lastTriggeredAt?: string
  lastBuildId?: string
}

export interface SafeWebhookConfig {
  id: string
  name: string
  provider: WebhookProvider
  projectId: string
  branch?: string
  enabled: boolean
  hasSecret: boolean
  createdAt: string
  updatedAt: string
  lastTriggeredAt?: string
  lastBuildId?: string
}

export interface CreateWebhookInput {
  id?: string
  name: string
  provider: WebhookProvider
  projectId: string
  secret: string
  branch?: string
  enabled?: boolean
}

export interface UpdateWebhookInput {
  name?: string
  provider?: WebhookProvider
  projectId?: string
  secret?: string
  branch?: string
  enabled?: boolean
}

interface WebhookRow {
  id: string
  name: string
  provider: WebhookProvider
  projectId: string
  secret: string
  branch: string | null
  enabled: number
  createdAt: string
  updatedAt: string
  lastTriggeredAt: string | null
  lastBuildId: string | null
}

function isProvider(value: unknown): value is WebhookProvider {
  return value === 'github' || value === 'codeup'
}

function normalizeBranch(branch?: string) {
  const normalized = branch?.trim()
  if (!normalized || normalized === '*') return undefined
  return normalized.replace(/^refs\/heads\//, '')
}

function toWebhook(row: WebhookRow): WebhookConfig {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    projectId: row.projectId,
    secret: row.secret,
    branch: row.branch ?? undefined,
    enabled: row.enabled === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastTriggeredAt: row.lastTriggeredAt ?? undefined,
    lastBuildId: row.lastBuildId ?? undefined,
  }
}

function toSafeWebhook(webhook: WebhookConfig): SafeWebhookConfig {
  return {
    id: webhook.id,
    name: webhook.name,
    provider: webhook.provider,
    projectId: webhook.projectId,
    branch: webhook.branch,
    enabled: webhook.enabled,
    hasSecret: !!webhook.secret,
    createdAt: webhook.createdAt,
    updatedAt: webhook.updatedAt,
    lastTriggeredAt: webhook.lastTriggeredAt,
    lastBuildId: webhook.lastBuildId,
  }
}

async function decryptWebhook(webhook: WebhookConfig): Promise<WebhookConfig> {
  if (!webhook.secret || !isEncrypted(webhook.secret)) return webhook

  return {
    ...webhook,
    secret: await decrypt(webhook.secret),
  }
}

export function assertWebhookProvider(value: unknown): WebhookProvider {
  if (!isProvider(value)) {
    throw new Error('Invalid webhook provider.')
  }

  return value
}

export async function getSafeWebhooks(): Promise<SafeWebhookConfig[]> {
  const db = getBusinessDatabase()
  const rows = db
    .prepare('select * from tbuild_webhook order by createdAt desc')
    .all() as WebhookRow[]
  return rows.map((row) => toSafeWebhook(toWebhook(row)))
}

export async function getWebhookById(
  id: string,
): Promise<WebhookConfig | null> {
  const db = getBusinessDatabase()
  const row = db
    .prepare('select * from tbuild_webhook where id = ?')
    .get(id) as WebhookRow | undefined
  return row ? decryptWebhook(toWebhook(row)) : null
}

export async function createWebhook(
  input: CreateWebhookInput,
): Promise<SafeWebhookConfig> {
  if (!input.name.trim()) throw new Error('Webhook name is required.')
  if (!input.projectId) throw new Error('Project is required.')
  if (!input.secret.trim()) throw new Error('Webhook secret is required.')

  const db = getBusinessDatabase()
  const provider = assertWebhookProvider(input.provider)
  const now = new Date().toISOString()
  const webhook: WebhookConfig = {
    id: input.id?.trim() || crypto.randomUUID(),
    name: input.name.trim(),
    provider,
    projectId: input.projectId,
    secret: await encrypt(input.secret.trim()),
    branch: normalizeBranch(input.branch),
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  }

  db.prepare(
    `insert into tbuild_webhook (
      id, name, provider, projectId, secret, branch, enabled,
      createdAt, updatedAt, lastTriggeredAt, lastBuildId
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    webhook.id,
    webhook.name,
    webhook.provider,
    webhook.projectId,
    webhook.secret,
    webhook.branch ?? null,
    webhook.enabled ? 1 : 0,
    webhook.createdAt,
    webhook.updatedAt,
    null,
    null,
  )

  return toSafeWebhook(webhook)
}

export async function updateWebhook(
  id: string,
  input: UpdateWebhookInput,
): Promise<SafeWebhookConfig | null> {
  const db = getBusinessDatabase()
  const existing = await getWebhookById(id)
  if (!existing) return null

  const updated: WebhookConfig = {
    ...existing,
    updatedAt: new Date().toISOString(),
  }

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) throw new Error('Webhook name is required.')
    updated.name = name
  }

  if (input.provider !== undefined) {
    updated.provider = assertWebhookProvider(input.provider)
  }

  if (input.projectId !== undefined) {
    if (!input.projectId) throw new Error('Project is required.')
    updated.projectId = input.projectId
  }

  if (input.secret !== undefined) {
    const secret = input.secret.trim()
    if (!secret) throw new Error('Webhook secret is required.')
    updated.secret = await encrypt(secret)
  }

  if (input.branch !== undefined) {
    updated.branch = normalizeBranch(input.branch)
  }

  if (input.enabled !== undefined) {
    updated.enabled = input.enabled
  }

  db.prepare(
    `update tbuild_webhook
     set name = ?, provider = ?, projectId = ?, secret = ?, branch = ?,
         enabled = ?, updatedAt = ?
     where id = ?`,
  ).run(
    updated.name,
    updated.provider,
    updated.projectId,
    updated.secret,
    updated.branch ?? null,
    updated.enabled ? 1 : 0,
    updated.updatedAt,
    id,
  )

  return toSafeWebhook(updated)
}

export async function deleteWebhook(id: string): Promise<boolean> {
  const db = getBusinessDatabase()
  const result = db.prepare('delete from tbuild_webhook where id = ?').run(id)
  return result.changes > 0
}

export async function recordWebhookTrigger(
  id: string,
  buildId: string,
): Promise<void> {
  const db = getBusinessDatabase()
  db.prepare(
    `update tbuild_webhook
     set lastTriggeredAt = ?, lastBuildId = ?, updatedAt = ?
     where id = ?`,
  ).run(new Date().toISOString(), buildId, new Date().toISOString(), id)
}
