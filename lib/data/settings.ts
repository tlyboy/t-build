import path from 'path'
import { encrypt, decrypt, isEncrypted } from '@/lib/crypto'
import { getDataDir } from '@/lib/db/paths'
import { getBusinessDatabase } from '@/lib/db/business'

export interface GitCredential {
  id: string
  name: string
  type: 'https' | 'ssh'
  username?: string
  password?: string
  sshKey?: string
}

export interface SafeGitCredential {
  id: string
  name: string
  type: 'https' | 'ssh'
  username?: string
  hasPassword?: boolean
  hasSshKey?: boolean
}

export interface Settings {
  workDir: string
  gitCredentials: GitCredential[]
}

interface GitCredentialRow {
  id: string
  name: string
  type: 'https' | 'ssh'
  username: string | null
  password: string | null
  sshKey: string | null
}

const defaultSettings: Settings = {
  workDir: path.join(getDataDir(), 'workspace'),
  gitCredentials: [],
}

function toCredential(row: GitCredentialRow): GitCredential {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    username: row.username ?? undefined,
    password: row.password ?? undefined,
    sshKey: row.sshKey ?? undefined,
  }
}

function toSafeCredential(credential: GitCredential): SafeGitCredential {
  return {
    id: credential.id,
    name: credential.name,
    type: credential.type,
    username: credential.username,
    hasPassword: !!credential.password,
    hasSshKey: !!credential.sshKey,
  }
}

async function encryptCredential(
  credential: Partial<Omit<GitCredential, 'id'>>,
): Promise<Partial<Omit<GitCredential, 'id'>>> {
  const encrypted = { ...credential }

  if (encrypted.password) {
    encrypted.password = await encrypt(encrypted.password)
  }
  if (encrypted.sshKey) {
    encrypted.sshKey = await encrypt(encrypted.sshKey)
  }

  return encrypted
}

async function decryptCredential(
  credential: GitCredential,
): Promise<GitCredential> {
  const decrypted = { ...credential }

  if (decrypted.password && isEncrypted(decrypted.password)) {
    decrypted.password = await decrypt(decrypted.password)
  }
  if (decrypted.sshKey && isEncrypted(decrypted.sshKey)) {
    decrypted.sshKey = await decrypt(decrypted.sshKey)
  }

  return decrypted
}

function readWorkDir() {
  const db = getBusinessDatabase()
  const row = db
    .prepare('select value from tbuild_setting where key = ?')
    .get('workDir') as { value: string } | undefined
  return row?.value ?? defaultSettings.workDir
}

function readCredentials() {
  const db = getBusinessDatabase()
  const rows = db
    .prepare('select * from tbuild_git_credential order by createdAt desc')
    .all() as GitCredentialRow[]
  return rows.map(toCredential)
}

export async function getSettings(): Promise<Settings> {
  return {
    workDir: readWorkDir(),
    gitCredentials: readCredentials(),
  }
}

export async function updateSettings(
  data: Partial<Settings>,
): Promise<Settings> {
  const db = getBusinessDatabase()

  if (data.workDir !== undefined) {
    db.prepare(
      `insert into tbuild_setting (key, value, updatedAt)
       values (?, ?, ?)
       on conflict(key) do update set value = excluded.value, updatedAt = excluded.updatedAt`,
    ).run('workDir', data.workDir, new Date().toISOString())
  }

  return getSettings()
}

export async function getSafeSettings(): Promise<{
  workDir: string
  gitCredentials: SafeGitCredential[]
}> {
  const settings = await getSettings()
  return {
    workDir: settings.workDir,
    gitCredentials: settings.gitCredentials.map(toSafeCredential),
  }
}

export async function addGitCredential(
  credential: Omit<GitCredential, 'id'>,
): Promise<SafeGitCredential> {
  const db = getBusinessDatabase()
  const now = new Date().toISOString()
  const encrypted = await encryptCredential(credential)
  const newCredential: GitCredential = {
    id: crypto.randomUUID(),
    name: encrypted.name ?? credential.name,
    type: encrypted.type ?? credential.type,
    username: encrypted.username,
    password: encrypted.password,
    sshKey: encrypted.sshKey,
  }

  db.prepare(
    `insert into tbuild_git_credential (
      id, name, type, username, password, sshKey, createdAt, updatedAt
    ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newCredential.id,
    newCredential.name,
    newCredential.type,
    newCredential.username ?? null,
    newCredential.password ?? null,
    newCredential.sshKey ?? null,
    now,
    now,
  )

  return toSafeCredential(newCredential)
}

export async function updateGitCredential(
  id: string,
  data: Partial<Omit<GitCredential, 'id'>>,
): Promise<SafeGitCredential | null> {
  const db = getBusinessDatabase()
  const current = (db
    .prepare('select * from tbuild_git_credential where id = ?')
    .get(id) ?? null) as GitCredentialRow | null
  if (!current) return null

  const encrypted = await encryptCredential(data)
  const updated: GitCredential = {
    ...toCredential(current),
    ...encrypted,
  }

  db.prepare(
    `update tbuild_git_credential
     set name = ?, type = ?, username = ?, password = ?, sshKey = ?, updatedAt = ?
     where id = ?`,
  ).run(
    updated.name,
    updated.type,
    updated.username ?? null,
    updated.password ?? null,
    updated.sshKey ?? null,
    new Date().toISOString(),
    id,
  )

  return toSafeCredential(updated)
}

export async function deleteGitCredential(id: string): Promise<boolean> {
  const db = getBusinessDatabase()
  const result = db
    .prepare('delete from tbuild_git_credential where id = ?')
    .run(id)
  return result.changes > 0
}

export async function getGitCredentialById(
  id: string,
): Promise<GitCredential | null> {
  const db = getBusinessDatabase()
  const row = db
    .prepare('select * from tbuild_git_credential where id = ?')
    .get(id) as GitCredentialRow | undefined
  return row ? decryptCredential(toCredential(row)) : null
}
