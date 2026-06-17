import fs from 'fs/promises'
import os from 'os'
import path from 'path'

export interface Project {
  id: string
  name: string
  path: string
  buildCommand: string
  createdAt: string
  updatedAt: string
  gitPullBeforeBuild?: boolean // 构建前 git pull
  outputPaths?: string[] // 构建产物路径，支持目录和文件
  gitCredentialId?: string // Git 凭证 ID
}

const DATA_DIR = path.join(os.homedir(), '.t-build')
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json')

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

async function readProjects(): Promise<Project[]> {
  await ensureDataDir()
  try {
    const data = await fs.readFile(PROJECTS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeProjects(projects: Project[]) {
  await ensureDataDir()
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2))
}

export async function getAllProjects(): Promise<Project[]> {
  return readProjects()
}

export async function getProjectById(id: string): Promise<Project | null> {
  const projects = await readProjects()
  return projects.find((p) => p.id === id) || null
}

export async function createProject(
  data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Project> {
  const projects = await readProjects()
  const now = new Date().toISOString()
  const project: Project = {
    id: crypto.randomUUID(),
    name: data.name,
    path: data.path,
    buildCommand: data.buildCommand,
    gitPullBeforeBuild: data.gitPullBeforeBuild,
    outputPaths: data.outputPaths,
    gitCredentialId: data.gitCredentialId,
    createdAt: now,
    updatedAt: now,
  }
  projects.push(project)
  await writeProjects(projects)
  return project
}

export async function updateProject(
  id: string,
  data: Partial<Omit<Project, 'id' | 'createdAt'>>,
): Promise<Project | null> {
  const projects = await readProjects()
  const index = projects.findIndex((p) => p.id === id)
  if (index === -1) return null

  projects[index] = {
    ...projects[index],
    ...data,
    updatedAt: new Date().toISOString(),
  }
  await writeProjects(projects)
  return projects[index]
}

export async function deleteProject(id: string): Promise<boolean> {
  const projects = await readProjects()
  const index = projects.findIndex((p) => p.id === id)
  if (index === -1) return false

  projects.splice(index, 1)
  await writeProjects(projects)
  return true
}
