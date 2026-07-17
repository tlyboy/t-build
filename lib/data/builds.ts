import { getBusinessDatabase } from '@/lib/db/business'

export type BuildStatus =
  'pending' | 'running' | 'success' | 'failed' | 'skipped'

export interface Build {
  id: string
  projectId: string
  status: BuildStatus
  startedAt: string
  finishedAt?: string
  exitCode?: number
  gitCommitHash?: string
  gitCommitMessage?: string
}

interface BuildRow {
  id: string
  projectId: string
  status: BuildStatus
  startedAt: string
  finishedAt: string | null
  exitCode: number | null
  gitCommitHash: string | null
  gitCommitMessage: string | null
}

const DEFAULT_BUILD_HISTORY_LIMIT = 5

function getBuildHistoryLimit(): number {
  const configuredLimit = process.env.T_BUILD_HISTORY_LIMIT?.trim()
  if (!configuredLimit) return DEFAULT_BUILD_HISTORY_LIMIT

  const limit = Number(configuredLimit)
  return Number.isSafeInteger(limit) && limit > 0
    ? limit
    : DEFAULT_BUILD_HISTORY_LIMIT
}

export async function pruneBuildHistory(): Promise<number> {
  const db = getBusinessDatabase()
  const result = db
    .prepare(
      `delete from tbuild_build
       where status not in ('pending', 'running')
         and id in (
           select id from tbuild_build
           order by startedAt desc, rowid desc
           limit -1 offset ?
         )`,
    )
    .run(getBuildHistoryLimit())

  return result.changes
}

function toBuild(row: BuildRow): Build {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt ?? undefined,
    exitCode: row.exitCode ?? undefined,
    gitCommitHash: row.gitCommitHash ?? undefined,
    gitCommitMessage: row.gitCommitMessage ?? undefined,
  }
}

export async function getAllBuilds(): Promise<Build[]> {
  await pruneBuildHistory()
  const db = getBusinessDatabase()
  const rows = db
    .prepare('select * from tbuild_build order by startedAt desc')
    .all() as BuildRow[]
  return rows.map(toBuild)
}

export async function getBuildById(id: string): Promise<Build | null> {
  const db = getBusinessDatabase()
  const row = db.prepare('select * from tbuild_build where id = ?').get(id) as
    BuildRow | undefined
  return row ? toBuild(row) : null
}

export async function getBuildsByProjectId(
  projectId: string,
): Promise<Build[]> {
  await pruneBuildHistory()
  const db = getBusinessDatabase()
  const rows = db
    .prepare(
      'select * from tbuild_build where projectId = ? order by startedAt desc',
    )
    .all(projectId) as BuildRow[]
  return rows.map(toBuild)
}

export async function createBuild(projectId: string): Promise<Build> {
  const db = getBusinessDatabase()
  const build: Build = {
    id: crypto.randomUUID(),
    projectId,
    status: 'pending',
    startedAt: new Date().toISOString(),
  }

  db.prepare(
    `insert into tbuild_build (
      id, projectId, status, startedAt, finishedAt, exitCode,
      gitCommitHash, gitCommitMessage
    ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    build.id,
    build.projectId,
    build.status,
    build.startedAt,
    null,
    null,
    null,
    null,
  )

  await pruneBuildHistory()

  return build
}

export async function updateBuild(
  id: string,
  data: Partial<Omit<Build, 'id' | 'projectId' | 'startedAt'>>,
): Promise<Build | null> {
  const db = getBusinessDatabase()
  const existing = await getBuildById(id)
  if (!existing) return null

  const updated: Build = {
    ...existing,
    ...data,
  }

  db.prepare(
    `update tbuild_build
     set status = ?, finishedAt = ?, exitCode = ?, gitCommitHash = ?,
         gitCommitMessage = ?
     where id = ?`,
  ).run(
    updated.status,
    updated.finishedAt ?? null,
    updated.exitCode ?? null,
    updated.gitCommitHash ?? null,
    updated.gitCommitMessage ?? null,
    id,
  )

  if (updated.status !== 'pending' && updated.status !== 'running') {
    await pruneBuildHistory()
  }

  return updated
}

export async function appendBuildLog(id: string, log: string): Promise<void> {
  await appendBuildLogs(id, [log])
}

export async function appendBuildLogs(
  id: string,
  logs: string[],
): Promise<void> {
  if (logs.length === 0) return

  const db = getBusinessDatabase()
  const now = new Date().toISOString()
  const insert = db.prepare(
    `insert into tbuild_build_log (buildId, line, createdAt)
     values (?, ?, ?)`,
  )

  db.transaction(() => {
    for (const log of logs) {
      insert.run(id, log, now)
    }
  })()
}

export async function getBuildLogs(id: string): Promise<string[]> {
  const db = getBusinessDatabase()
  const rows = db
    .prepare('select line from tbuild_build_log where buildId = ? order by id')
    .all(id) as Array<{ line: string }>
  return rows.map((row) => row.line)
}

export async function deleteBuild(id: string): Promise<boolean> {
  const db = getBusinessDatabase()
  const result = db.prepare('delete from tbuild_build where id = ?').run(id)
  return result.changes > 0
}

export async function deleteProjectBuilds(projectId: string): Promise<number> {
  const db = getBusinessDatabase()
  const result = db
    .prepare('delete from tbuild_build where projectId = ?')
    .run(projectId)
  return result.changes
}
