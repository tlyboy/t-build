import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { encrypt, decrypt, isEncrypted } from '@/lib/crypto'

const MASK = '***'

export interface EnvVar {
  key: string
  value: string
}

export interface MaskedEnvVar {
  key: string
  value: string
}

interface StoredEnvVar {
  projectId: string
  key: string
  value: string // encrypted
}

const DATA_DIR = path.join(os.homedir(), '.t-build')
const ENV_FILE = path.join(DATA_DIR, 'env-vars.json')

let writeLock: Promise<void> = Promise.resolve()

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

async function readEnvVars(): Promise<StoredEnvVar[]> {
  await ensureDataDir()
  try {
    const data = await fs.readFile(ENV_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeEnvVars(vars: StoredEnvVar[]) {
  await ensureDataDir()
  await fs.writeFile(ENV_FILE, JSON.stringify(vars, null, 2))
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const previousLock = writeLock
  let resolve: () => void
  writeLock = new Promise((r) => {
    resolve = r
  })

  try {
    await previousLock
    return await fn()
  } finally {
    resolve!()
  }
}

export async function getEnvVars(projectId: string): Promise<MaskedEnvVar[]> {
  const all = await readEnvVars()
  return all
    .filter((v) => v.projectId === projectId)
    .map((v) => ({ key: v.key, value: MASK }))
}

export async function setEnvVars(
  projectId: string,
  vars: EnvVar[],
): Promise<void> {
  await withLock(async () => {
    const all = await readEnvVars()

    // Deduplicate by key (last value wins)
    const deduped = new Map<string, string>()
    for (const v of vars) {
      deduped.set(v.key, v.value)
    }

    // Read existing encrypted values to preserve unchanged ones
    const existingMap = new Map<string, string>()
    for (const row of all) {
      if (row.projectId === projectId) {
        existingMap.set(row.key, row.value)
      }
    }

    // Build new entries for this project
    const newEntries: StoredEnvVar[] = await Promise.all(
      [...deduped.entries()].map(async ([key, value]) => ({
        projectId,
        key,
        value:
          value === MASK && existingMap.has(key)
            ? existingMap.get(key)!
            : await encrypt(value),
      })),
    )

    // Replace all entries for this project
    const others = all.filter((v) => v.projectId !== projectId)
    await writeEnvVars([...others, ...newEntries])
  })
}

export async function getEnvVarsForBuild(
  projectId: string,
): Promise<Record<string, string>> {
  const all = await readEnvVars()
  const projectVars = all.filter((v) => v.projectId === projectId)
  if (projectVars.length === 0) return {}

  const result: Record<string, string> = {}
  for (const row of projectVars) {
    if (isEncrypted(row.value)) {
      result[row.key] = await decrypt(row.value)
    } else {
      result[row.key] = row.value
    }
  }
  return result
}

export async function deleteEnvVarsByProjectId(
  projectId: string,
): Promise<void> {
  await withLock(async () => {
    const all = await readEnvVars()
    const filtered = all.filter((v) => v.projectId !== projectId)
    await writeEnvVars(filtered)
  })
}
