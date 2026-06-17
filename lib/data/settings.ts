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
  password?: string // Encrypted storage
  // SSH - stores private key contents
  sshKey?: string // Encrypted storage
}

// Types of secure credentials returned by the API (excluding sensitive information)
export interface SafeGitCredential {
  id: string
  name: string
  type: 'https' | 'ssh'
  username?: string
  hasPassword?: boolean // Whether a password is configured
  hasSshKey?: boolean // Whether an SSH key is configured
}

export interface Settings {
  workDir: string // Working directory
  gitCredentials: GitCredential[] // Git authentication configuration
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

// Encrypt sensitive information in credentials
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

// Decrypt sensitive information in credentials
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

// Convert credentials to a secure format (excluding sensitive information)
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

// Get secure settings (for API responses)
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

  // Encrypt sensitive fields
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

// Get complete credentials (including decrypted sensitive information, for internal use only)
export async function getGitCredentialById(
  id: string,
): Promise<GitCredential | null> {
  const settings = await getSettings()
  const credential = settings.gitCredentials.find((c) => c.id === id)
  if (!credential) return null
  return decryptCredential(credential)
}
