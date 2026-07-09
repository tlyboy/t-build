import { getBusinessDatabase } from '@/lib/db/business'

export interface Project {
  id: string
  name: string
  path: string
  buildCommand: string
  deployCommand?: string
  createdAt: string
  updatedAt: string
  gitPullBeforeBuild?: boolean
  outputPaths?: string[]
  gitCredentialId?: string
}

interface ProjectRow {
  id: string
  name: string
  path: string
  buildCommand: string
  deployCommand: string | null
  createdAt: string
  updatedAt: string
  gitPullBeforeBuild: number
  outputPaths: string | null
  gitCredentialId: string | null
}

function parseOutputPaths(value: string | null) {
  if (!value) return undefined

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed)
      ? parsed.filter(Boolean).map(String)
      : undefined
  } catch {
    return undefined
  }
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    buildCommand: row.buildCommand,
    deployCommand: row.deployCommand ?? undefined,
    gitPullBeforeBuild: row.gitPullBeforeBuild === 1,
    outputPaths: parseOutputPaths(row.outputPaths),
    gitCredentialId: row.gitCredentialId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function getAllProjects(): Promise<Project[]> {
  const db = getBusinessDatabase()
  const rows = db
    .prepare('select * from tbuild_project order by createdAt desc')
    .all() as ProjectRow[]
  return rows.map(toProject)
}

export async function getProjectById(id: string): Promise<Project | null> {
  const db = getBusinessDatabase()
  const row = db
    .prepare('select * from tbuild_project where id = ?')
    .get(id) as ProjectRow | undefined
  return row ? toProject(row) : null
}

export async function createProject(
  data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Project> {
  const db = getBusinessDatabase()
  const now = new Date().toISOString()
  const project: Project = {
    id: crypto.randomUUID(),
    name: data.name,
    path: data.path,
    buildCommand: data.buildCommand,
    deployCommand: data.deployCommand,
    gitPullBeforeBuild: data.gitPullBeforeBuild,
    outputPaths: data.outputPaths,
    gitCredentialId: data.gitCredentialId,
    createdAt: now,
    updatedAt: now,
  }

  db.prepare(
    `insert into tbuild_project (
      id, name, path, buildCommand, deployCommand, gitPullBeforeBuild,
      outputPaths, gitCredentialId, createdAt, updatedAt
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    project.id,
    project.name,
    project.path,
    project.buildCommand,
    project.deployCommand?.trim() || null,
    project.gitPullBeforeBuild ? 1 : 0,
    project.outputPaths ? JSON.stringify(project.outputPaths) : null,
    project.gitCredentialId ?? null,
    project.createdAt,
    project.updatedAt,
  )

  return project
}

export async function updateProject(
  id: string,
  data: Partial<Omit<Project, 'id' | 'createdAt'>>,
): Promise<Project | null> {
  const db = getBusinessDatabase()
  const existing = await getProjectById(id)
  if (!existing) return null

  const updated: Project = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString(),
  }

  db.prepare(
    `update tbuild_project
     set name = ?, path = ?, buildCommand = ?, deployCommand = ?,
         gitPullBeforeBuild = ?, outputPaths = ?, gitCredentialId = ?,
         updatedAt = ?
     where id = ?`,
  ).run(
    updated.name,
    updated.path,
    updated.buildCommand,
    updated.deployCommand?.trim() || null,
    updated.gitPullBeforeBuild ? 1 : 0,
    updated.outputPaths ? JSON.stringify(updated.outputPaths) : null,
    updated.gitCredentialId ?? null,
    updated.updatedAt,
    id,
  )

  return updated
}

export async function deleteProject(id: string): Promise<boolean> {
  const db = getBusinessDatabase()
  const result = db.prepare('delete from tbuild_project where id = ?').run(id)
  return result.changes > 0
}
