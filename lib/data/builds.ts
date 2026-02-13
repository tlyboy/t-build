import fs from 'fs/promises'
import path from 'path'

export type BuildStatus = 'pending' | 'running' | 'success' | 'failed'

export interface Build {
  id: string
  projectId: string
  status: BuildStatus
  startedAt: string
  finishedAt?: string
  logs: string[]
  exitCode?: number
  gitCommitHash?: string // 构建时的 commit hash
  gitCommitMessage?: string // commit 提交信息
}

const DATA_DIR = path.join(process.cwd(), 'data')
const BUILDS_FILE = path.join(DATA_DIR, 'builds.json')

let writeLock: Promise<void> = Promise.resolve()

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

async function readBuilds(): Promise<Build[]> {
  await ensureDataDir()
  try {
    const data = await fs.readFile(BUILDS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeBuilds(builds: Build[]) {
  await ensureDataDir()
  await fs.writeFile(BUILDS_FILE, JSON.stringify(builds, null, 2))
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

export async function getAllBuilds(): Promise<Build[]> {
  return readBuilds()
}

export async function getBuildById(id: string): Promise<Build | null> {
  const builds = await readBuilds()
  return builds.find((b) => b.id === id) || null
}

export async function getBuildsByProjectId(
  projectId: string,
): Promise<Build[]> {
  const builds = await readBuilds()
  return builds.filter((b) => b.projectId === projectId)
}

export async function createBuild(projectId: string): Promise<Build> {
  return withLock(async () => {
    const builds = await readBuilds()
    const build: Build = {
      id: crypto.randomUUID(),
      projectId,
      status: 'pending',
      startedAt: new Date().toISOString(),
      logs: [],
    }
    builds.push(build)
    await writeBuilds(builds)
    return build
  })
}

export async function updateBuild(
  id: string,
  data: Partial<Omit<Build, 'id' | 'projectId' | 'startedAt'>>,
): Promise<Build | null> {
  return withLock(async () => {
    const builds = await readBuilds()
    const index = builds.findIndex((b) => b.id === id)
    if (index === -1) return null

    builds[index] = {
      ...builds[index],
      ...data,
    }
    await writeBuilds(builds)
    return builds[index]
  })
}

export async function appendBuildLog(
  id: string,
  log: string,
): Promise<Build | null> {
  return withLock(async () => {
    const builds = await readBuilds()
    const index = builds.findIndex((b) => b.id === id)
    if (index === -1) return null

    builds[index].logs.push(log)
    await writeBuilds(builds)
    return builds[index]
  })
}

export async function appendBuildLogs(
  id: string,
  logs: string[],
): Promise<Build | null> {
  return withLock(async () => {
    const builds = await readBuilds()
    const index = builds.findIndex((b) => b.id === id)
    if (index === -1) return null

    builds[index].logs.push(...logs)
    await writeBuilds(builds)
    return builds[index]
  })
}

export async function deleteBuild(id: string): Promise<boolean> {
  return withLock(async () => {
    const builds = await readBuilds()
    const index = builds.findIndex((b) => b.id === id)
    if (index === -1) return false

    builds.splice(index, 1)
    await writeBuilds(builds)
    return true
  })
}

export async function deleteProjectBuilds(projectId: string): Promise<number> {
  return withLock(async () => {
    const builds = await readBuilds()
    const filtered = builds.filter((b) => b.projectId !== projectId)
    const deletedCount = builds.length - filtered.length
    await writeBuilds(filtered)
    return deletedCount
  })
}
