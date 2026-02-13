import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

const DATA_DIR = path.join(process.cwd(), 'data')
const KEY_FILE = path.join(DATA_DIR, '.encryption-key')

let encryptionKey: Buffer | null = null

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

async function getOrCreateKey(): Promise<Buffer> {
  if (encryptionKey) return encryptionKey

  await ensureDataDir()

  try {
    const keyHex = await fs.readFile(KEY_FILE, 'utf-8')
    encryptionKey = Buffer.from(keyHex.trim(), 'hex')
  } catch {
    // 生成新密钥
    encryptionKey = crypto.randomBytes(KEY_LENGTH)
    await fs.writeFile(KEY_FILE, encryptionKey.toString('hex'), { mode: 0o600 })
  }

  return encryptionKey
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getOrCreateKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // 格式: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export async function decrypt(ciphertext: string): Promise<string> {
  const key = await getOrCreateKey()
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':')

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid ciphertext format')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

// 检查字符串是否是加密格式
export function isEncrypted(value: string): boolean {
  const parts = value.split(':')
  return (
    parts.length === 3 &&
    parts[0].length === IV_LENGTH * 2 &&
    parts[1].length === AUTH_TAG_LENGTH * 2
  )
}
