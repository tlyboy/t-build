import fs from 'fs/promises'
import os from 'os'
import path from 'path'

export type BuildStatus = 'pending' | 'running' | 'success' | 'failed'

export interface Build {
  id: string
  projectId: string
  status: BuildStatus
  startedAt: string
  finishedAt?: string
  exitCode?: number
  gitCommitHash?: string // 构建时的 commit hash
  gitCommitMessage?: string // commit 提交信息
}

const DATA_DIR = path.join(os.homedir(), '.t-build')
const BUILDS_FILE = path.join(DATA_DIR, 'builds.json')
const LOGS_DIR = path.join(DATA_DIR, 'logs')

let writeLock: Promise<void> = Promise.resolve()

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

async function ensureLogsDir() {
  try {
    await fs.access(LOGS_DIR)
  } catch {
    await fs.mkdir(LOGS_DIR, { recursive: true })
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

// File-based log operations
export async function appendBuildLog(id: string, log: string): Promise<void> {
  await ensureLogsDir()
  const logFile = path.join(LOGS_DIR, `${id}.jsonl`)
  await fs.appendFile(logFile, JSON.stringify(log) + '\n')
}

export async function appendBuildLogs(
  id: string,
  logs: string[],
): Promise<void> {
  await ensureLogsDir()
  const logFile = path.join(LOGS_DIR, `${id}.jsonl`)
  const content = logs.map((log) => JSON.stringify(log)).join('\n') + '\n'
  await fs.appendFile(logFile, content)
}

export async function getBuildLogs(id: string): Promise<string[]> {
  try {
    const logFile = path.join(LOGS_DIR, `${id}.jsonl`)
    const content = await fs.readFile(logFile, 'utf-8')
    return content
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  } catch {
    return []
  }
}

export async function deleteBuild(id: string): Promise<boolean> {
  return withLock(async () => {
    const builds = await readBuilds()
    const index = builds.findIndex((b) => b.id === id)
    if (index === -1) return false

    builds.splice(index, 1)
    await writeBuilds(builds)

    // Also delete log file
    try {
      await fs.unlink(path.join(LOGS_DIR, `${id}.jsonl`))
    } catch {
      // ignore
    }

    return true
  })
}

export async function deleteProjectBuilds(projectId: string): Promise<number> {
  return withLock(async () => {
    const builds = await readBuilds()
    const toDelete = builds.filter((b) => b.projectId === projectId)
    const filtered = builds.filter((b) => b.projectId !== projectId)
    const deletedCount = toDelete.length
    await writeBuilds(filtered)

    // Clean up log files
    for (const build of toDelete) {
      try {
        await fs.unlink(path.join(LOGS_DIR, `${build.id}.jsonl`))
      } catch {
        // ignore
      }
    }

    return deletedCount
  })
}
