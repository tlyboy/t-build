import { encrypt, decrypt, isEncrypted } from '@/lib/crypto'
import { getBusinessDatabase } from '@/lib/db/business'

const MASK = '***'

export interface EnvVar {
  key: string
  value: string
}

export interface MaskedEnvVar {
  key: string
  value: string
}

interface EnvVarRow {
  projectId: string
  key: string
  value: string
}

export async function getEnvVars(projectId: string): Promise<MaskedEnvVar[]> {
  const db = getBusinessDatabase()
  const rows = db
    .prepare('select key from tbuild_env_var where projectId = ? order by key')
    .all(projectId) as Array<{ key: string }>

  return rows.map((row) => ({ key: row.key, value: MASK }))
}

export async function setEnvVars(
  projectId: string,
  vars: EnvVar[],
): Promise<void> {
  const db = getBusinessDatabase()
  const now = new Date().toISOString()

  const existingRows = db
    .prepare('select key, value from tbuild_env_var where projectId = ?')
    .all(projectId) as Array<{ key: string; value: string }>
  const existingMap = new Map(existingRows.map((row) => [row.key, row.value]))

  const deduped = new Map<string, string>()
  for (const envVar of vars) {
    deduped.set(envVar.key, envVar.value)
  }

  const nextEntries = await Promise.all(
    [...deduped.entries()].map(async ([key, value]) => ({
      key,
      value:
        value === MASK && existingMap.has(key)
          ? existingMap.get(key)!
          : await encrypt(value),
    })),
  )

  const insert = db.prepare(
    `insert into tbuild_env_var (projectId, key, value, createdAt, updatedAt)
     values (?, ?, ?, ?, ?)
     on conflict(projectId, key) do update
     set value = excluded.value, updatedAt = excluded.updatedAt`,
  )

  db.transaction(() => {
    db.prepare('delete from tbuild_env_var where projectId = ?').run(projectId)
    for (const entry of nextEntries) {
      insert.run(projectId, entry.key, entry.value, now, now)
    }
  })()
}

export async function getEnvVarsForBuild(
  projectId: string,
): Promise<Record<string, string>> {
  const db = getBusinessDatabase()
  const rows = db
    .prepare(
      'select projectId, key, value from tbuild_env_var where projectId = ?',
    )
    .all(projectId) as EnvVarRow[]

  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = isEncrypted(row.value)
      ? await decrypt(row.value)
      : row.value
  }
  return result
}

export async function deleteEnvVarsByProjectId(
  projectId: string,
): Promise<void> {
  const db = getBusinessDatabase()
  db.prepare('delete from tbuild_env_var where projectId = ?').run(projectId)
}
