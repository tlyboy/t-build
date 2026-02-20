import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { encrypt, decrypt, isEncrypted } from '../crypto'

export interface GitCredential {
  id: string
  name: string
  type: 'https' | 'ssh'
  // HTTPS
  username?: string
  password?: string // 加密存储
  // SSH - 存储私钥内容
  sshKey?: string // 加密存储
}

// 用于 API 返回的安全凭证类型（不包含敏感信息）
export interface SafeGitCredential {
  id: string
  name: string
  type: 'https' | 'ssh'
  username?: string
  hasPassword?: boolean // 是否已配置密码
  hasSshKey?: boolean // 是否已配置 SSH 密钥
}

export interface Settings {
  workDir: string // 工作目录
  gitCredentials: GitCredential[] // Git 认证配置
}

const DATA_DIR = path.join(os.homedir(), '.t-build')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

const defaultSettings: Settings = {
  workDir: path.join(DATA_DIR, 'workspace'),
  gitCredentials: [],
}

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

export async function getSettings(): Promise<Settings> {
  await ensureDataDir()
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8')
    return { ...defaultSettings, ...JSON.parse(data) }
  } catch {
    return defaultSettings
  }
}

export async function updateSettings(
  data: Partial<Settings>,
): Promise<Settings> {
  await ensureDataDir()
  const current = await getSettings()
  const updated = { ...current, ...data }
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(updated, null, 2))
  return updated
}

// 加密凭证中的敏感信息
async function encryptCredential(
  credential: Omit<GitCredential, 'id'>,
): Promise<Omit<GitCredential, 'id'>> {
  const encrypted = { ...credential }

  if (encrypted.password) {
    encrypted.password = await encrypt(encrypted.password)
  }
  if (encrypted.sshKey) {
    encrypted.sshKey = await encrypt(encrypted.sshKey)
  }

  return encrypted
}

// 解密凭证中的敏感信息
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

// 将凭证转换为安全格式（不包含敏感信息）
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

// 获取安全的设置（用于 API 返回）
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
  const settings = await getSettings()
  const encrypted = await encryptCredential(credential)
  const newCredential: GitCredential = {
    ...encrypted,
    id: crypto.randomUUID(),
  }
  settings.gitCredentials.push(newCredential)
  await updateSettings({ gitCredentials: settings.gitCredentials })
  return toSafeCredential(newCredential)
}

export async function updateGitCredential(
  id: string,
  data: Partial<Omit<GitCredential, 'id'>>,
): Promise<SafeGitCredential | null> {
  const settings = await getSettings()
  const index = settings.gitCredentials.findIndex((c) => c.id === id)
  if (index === -1) return null

  // 加密敏感字段
  const encrypted = await encryptCredential(data as Omit<GitCredential, 'id'>)

  settings.gitCredentials[index] = {
    ...settings.gitCredentials[index],
    ...encrypted,
  }
  await updateSettings({ gitCredentials: settings.gitCredentials })
  return toSafeCredential(settings.gitCredentials[index])
}

export async function deleteGitCredential(id: string): Promise<boolean> {
  const settings = await getSettings()
  const index = settings.gitCredentials.findIndex((c) => c.id === id)
  if (index === -1) return false

  settings.gitCredentials.splice(index, 1)
  await updateSettings({ gitCredentials: settings.gitCredentials })
  return true
}

// 获取完整凭证（包含解密后的敏感信息，仅用于内部使用）
export async function getGitCredentialById(
  id: string,
): Promise<GitCredential | null> {
  const settings = await getSettings()
  const credential = settings.gitCredentials.find((c) => c.id === id)
  if (!credential) return null
  return decryptCredential(credential)
}
