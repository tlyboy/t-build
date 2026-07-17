import { spawn, ChildProcess, execSync } from 'child_process'
import path from 'path'
import os from 'os'
import { updateBuild, appendBuildLogs, getBuildById } from './data/builds'
import { getProjectById, Project } from './data/projects'
import { getGitCredentialById, getSettings } from './data/settings'
import { getEnvVarsForBuild } from './data/env-vars'
import { EventEmitter } from 'events'

export interface EnqueueBuildResult {
  buildId: string
  supersededBuildId?: string
}

// globalThis ensures shared state across Next.js route bundles
const g = globalThis as {
  __tbuild?: {
    emitters: Map<string, EventEmitter>
    processes: Map<string, ChildProcess>
    buildLogs: Map<string, string[]>
    queue: string[]
    queuedProjects?: Map<string, string>
    processing: boolean
    runningBuildId?: string
    runningProjectId?: string
  }
}
const state = (g.__tbuild ??= {
  emitters: new Map<string, EventEmitter>(),
  processes: new Map<string, ChildProcess>(),
  buildLogs: new Map<string, string[]>(),
  queue: [] as string[],
  queuedProjects: new Map<string, string>(),
  processing: false,
})
const queuedProjects = (state.queuedProjects ??= new Map<string, string>())

const MAX_QUEUE_LENGTH = 50

async function skipSupersededBuild(
  skippedBuildId: string,
  newerBuildId: string,
): Promise<void> {
  const shortNewerBuildId = newerBuildId.slice(0, 8)
  const logLine = `[T-Build] Skipped: a newer build (${shortNewerBuildId}) was queued for this project.`

  state.buildLogs.set(skippedBuildId, [
    ...(state.buildLogs.get(skippedBuildId) ?? []),
    logLine,
  ])
  await appendBuildLogs(skippedBuildId, [logLine])
  await updateBuild(skippedBuildId, {
    status: 'skipped',
    finishedAt: new Date().toISOString(),
  })

  const emitter = getBuildEmitter(skippedBuildId)
  emitter.emit('log', logLine)
  emitter.emit('status', 'skipped')
  emitter.emit('done', {
    status: 'skipped',
    skippedByBuildId: newerBuildId,
  })

  setTimeout(() => cleanupBuildEmitter(skippedBuildId), 60000)
}

export async function enqueueBuild(
  buildId: string,
): Promise<EnqueueBuildResult> {
  const build = await getBuildById(buildId)
  if (!build) {
    throw new Error(`Build ${buildId} not found`)
  }
  if (build.status !== 'pending') {
    throw new Error(`Build ${buildId} is not pending`)
  }

  const queuedBuildId = queuedProjects.get(build.projectId)
  if (queuedBuildId) {
    const queueIndex = state.queue.indexOf(queuedBuildId)
    if (queueIndex >= 0) {
      state.queue[queueIndex] = buildId
      queuedProjects.set(build.projectId, buildId)
      await skipSupersededBuild(queuedBuildId, buildId)
      void processQueue()
      return { buildId, supersededBuildId: queuedBuildId }
    }

    queuedProjects.delete(build.projectId)
  }

  if (state.queue.length >= MAX_QUEUE_LENGTH) {
    throw new Error('Build queue is full')
  }

  state.queue.push(buildId)
  queuedProjects.set(build.projectId, buildId)
  void processQueue()
  return { buildId }
}

async function processQueue(): Promise<void> {
  if (state.processing) return

  state.processing = true

  try {
    while (state.queue.length > 0) {
      const nextBuildId = state.queue.shift()!
      const build = await getBuildById(nextBuildId)

      if (!build) continue

      if (queuedProjects.get(build.projectId) === nextBuildId) {
        queuedProjects.delete(build.projectId)
      }

      if (build.status !== 'pending') continue

      state.runningBuildId = nextBuildId
      state.runningProjectId = build.projectId

      try {
        await executeBuild(nextBuildId)
      } catch (error) {
        console.error(`Build ${nextBuildId} failed:`, error)
      } finally {
        state.runningBuildId = undefined
        state.runningProjectId = undefined
      }
    }
  } finally {
    state.processing = false
    if (state.queue.length > 0) {
      void processQueue()
    }
  }
}

export function getBuildEmitter(buildId: string): EventEmitter {
  let emitter = state.emitters.get(buildId)
  if (!emitter) {
    emitter = new EventEmitter()
    state.emitters.set(buildId, emitter)
  }
  return emitter
}

export function cleanupBuildEmitter(buildId: string) {
  state.emitters.delete(buildId)
  state.buildLogs.delete(buildId)
}

export function getBuildMemoryLogs(buildId: string): string[] {
  return state.buildLogs.get(buildId) || []
}

function resolveProjectPath(workDir: string, projectPath: string): string {
  if (path.isAbsolute(projectPath)) return projectPath
  return path.join(workDir, projectPath)
}

interface GitCommandResult {
  success: boolean
  exitCode: number | null
}

function executeGitCommand(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  logLine: (line: string) => void,
): Promise<GitCommandResult> {
  return new Promise((resolve) => {
    let settled = false
    let timedOut = false

    const finish = (result: GitCommandResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    logLine(`[T-Build] Executing git ${args.join(' ')}...`)

    const child = spawn('git', args, {
      cwd,
      env,
    })

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      logLine(`[T-Build] Git command timed out: git ${args.join(' ')}`)
    }, 30 * 1000)

    child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      for (const line of lines) {
        if (line) logLine(`[git] ${line}`)
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      for (const line of lines) {
        if (line) logLine(`[git] ${line}`)
      }
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      finish({ success: code === 0 && !timedOut, exitCode: code })
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      logLine(`[T-Build] Git command error: ${error.message}`)
      finish({ success: false, exitCode: null })
    })
  })
}

async function executeGitPull(
  project: Project,
  projectDir: string,
  buildId: string,
  logLine: (line: string) => void,
): Promise<{ success: boolean; commitHash?: string; commitMessage?: string }> {
  const env = { ...process.env } as NodeJS.ProcessEnv
  let tempKeyPath: string | null = null

  // Configure authentication if credentials are provided
  if (project.gitCredentialId) {
    const credential = await getGitCredentialById(project.gitCredentialId)
    if (credential?.type === 'ssh' && credential.sshKey) {
      // Write the SSH key to a temporary file, normalize line endings to LF, and ensure it ends with a newline
      const fs = await import('fs/promises')
      tempKeyPath = path.join(os.tmpdir(), `t-build-ssh-${buildId}`)
      const normalizedKey =
        credential.sshKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim() +
        '\n'
      await fs.writeFile(tempKeyPath, normalizedKey, { mode: 0o600 })
      env.GIT_SSH_COMMAND = `ssh -i "${tempKeyPath}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`
      logLine('[T-Build] Using SSH credential')
    }
  }

  const cleanup = async () => {
    if (tempKeyPath) {
      try {
        const fs = await import('fs/promises')
        await fs.unlink(tempKeyPath)
      } catch {
        // ignore
      }
    }
  }

  // Prevent any credential helper / SSH from hanging
  if (!env.GIT_SSH_COMMAND) {
    env.GIT_SSH_COMMAND = 'ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no'
  }

  const gitEnv: NodeJS.ProcessEnv = {
    ...env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: '/bin/echo',
    GIT_CONFIG_NOSYSTEM: '1',
  }

  try {
    logLine('[T-Build] Restoring Git working tree before pull...')

    const resetResult = await executeGitCommand(
      ['reset', '--hard', 'HEAD'],
      projectDir,
      gitEnv,
      logLine,
    )
    if (!resetResult.success) {
      logLine(
        `[T-Build] Git reset failed with exit code: ${resetResult.exitCode}`,
      )
      return { success: false }
    }

    const cleanResult = await executeGitCommand(
      ['clean', '-fd'],
      projectDir,
      gitEnv,
      logLine,
    )
    if (!cleanResult.success) {
      logLine(
        `[T-Build] Git clean failed with exit code: ${cleanResult.exitCode}`,
      )
      return { success: false }
    }

    logLine('[T-Build] Git working tree restored')

    const pullResult = await executeGitCommand(
      ['pull', '--ff-only'],
      projectDir,
      gitEnv,
      logLine,
    )
    if (!pullResult.success) {
      logLine(
        `[T-Build] Git pull failed with exit code: ${pullResult.exitCode}`,
      )
      return { success: false }
    }

    const gitInfo = getGitInfo(projectDir)
    if (gitInfo.hash) {
      logLine(
        `[T-Build] Git pull successful, commit: ${gitInfo.hash.substring(0, 8)}`,
      )
      if (gitInfo.message) {
        logLine(`[T-Build] Commit message: ${gitInfo.message}`)
      }
    } else {
      logLine('[T-Build] Git pull successful')
    }

    return {
      success: true,
      commitHash: gitInfo.hash,
      commitMessage: gitInfo.message,
    }
  } finally {
    await cleanup()
  }
}

interface GitInfo {
  hash?: string
  message?: string
}

function getGitInfo(projectPath: string): GitInfo {
  try {
    const hash = execSync('git rev-parse HEAD', {
      cwd: projectPath,
      encoding: 'utf-8',
    }).trim()

    // Get the commit message (first line)
    const message = execSync('git log -1 --pretty=%s', {
      cwd: projectPath,
      encoding: 'utf-8',
    }).trim()

    return { hash, message }
  } catch {
    return {}
  }
}

// Generic function for executing a single command
async function executeCommand(
  command: string,
  cwd: string,
  logLine: (line: string) => void,
  extraEnv?: Record<string, string>,
): Promise<{ success: boolean; exitCode: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(command, [], {
      cwd,
      shell: true,
      env: {
        ...process.env,
        FORCE_COLOR: '1',
        ...extraEnv,
      },
    })

    child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      for (const line of lines) {
        if (line) logLine(line)
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      for (const line of lines) {
        if (line) logLine(line)
      }
    })

    child.on('close', (code) => {
      resolve({ success: code === 0, exitCode: code })
    })

    child.on('error', (error) => {
      logLine(`[T-Build] Error: ${error.message}`)
      resolve({ success: false, exitCode: null })
    })
  })
}

export async function executeBuild(buildId: string): Promise<void> {
  const build = await getBuildById(buildId)
  if (!build) {
    throw new Error(`Build ${buildId} not found`)
  }
  if (build.status !== 'pending') {
    return
  }

  const project = await getProjectById(build.projectId)
  if (!project) {
    throw new Error(`Project ${build.projectId} not found`)
  }

  // Resolve relative project path to absolute using workDir
  const settings = await getSettings()
  const projectDir = resolveProjectPath(settings.workDir, project.path)

  const emitter = getBuildEmitter(buildId)
  state.buildLogs.set(buildId, [])

  await updateBuild(buildId, { status: 'running' })
  emitter.emit('status', 'running')

  const pendingLogs: string[] = []
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  const flushLogs = async () => {
    if (pendingLogs.length === 0) return
    const logsToWrite = [...pendingLogs]
    pendingLogs.length = 0
    await appendBuildLogs(buildId, logsToWrite)
  }

  let secretValues: string[] = []

  const workDir = settings.workDir
  // Path variants for different tool output formats on Windows
  const workDirFwd = workDir.replaceAll('\\', '/') // Vite/Rollup: C:/Users/...
  const workDirEsc = workDir.replaceAll('\\', '\\\\') // Rust Debug: C:\\Users\\...
  const shortPath = (p: string) =>
    p.startsWith(workDir) ? p.slice(workDir.length + 1) || '/' : p

  const logLine = (line: string) => {
    // Strip workspace absolute path from all output
    let sanitized = line
      .replaceAll(workDir + '/', '')
      .replaceAll(workDir + '\\', '')
      .replaceAll(workDir, '.')
    if (workDirFwd !== workDir) {
      sanitized = sanitized
        .replaceAll(workDirFwd + '/', '')
        .replaceAll(workDirFwd, '.')
    }
    if (workDirEsc !== workDir) {
      sanitized = sanitized
        .replaceAll(workDirEsc + '\\\\', '')
        .replaceAll(workDirEsc, '.')
    }
    for (const secret of secretValues) {
      sanitized = sanitized.replaceAll(secret, '***')
    }
    state.buildLogs.get(buildId)?.push(sanitized)
    pendingLogs.push(sanitized)
    emitter.emit('log', sanitized)

    if (!flushTimer) {
      flushTimer = setTimeout(async () => {
        flushTimer = null
        await flushLogs()
      }, 500)
    }
  }

  logLine(`[T-Build] Starting build for project: ${project.name}`)
  logLine(`[T-Build] Working directory: ${shortPath(projectDir)}`)

  let commitHash: string | undefined
  let commitMessage: string | undefined

  // Run git pull before the build if configured
  if (project.gitPullBeforeBuild) {
    logLine('')
    const gitResult = await executeGitPull(
      project,
      projectDir,
      buildId,
      logLine,
    )
    if (!gitResult.success) {
      logLine('')
      logLine('[T-Build] Build aborted due to git pull failure')

      if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
      }
      await flushLogs()

      await updateBuild(buildId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
      })

      emitter.emit('status', 'failed')
      emitter.emit('done', { status: 'failed', error: 'Git pull failed' })

      setTimeout(() => cleanupBuildEmitter(buildId), 60000)
      return
    }
    commitHash = gitResult.commitHash
    commitMessage = gitResult.commitMessage
  } else {
    // Try to get the current commit info even if not pulling
    const gitInfo = getGitInfo(projectDir)
    commitHash = gitInfo.hash
    commitMessage = gitInfo.message
  }

  if (commitHash) {
    await updateBuild(buildId, {
      gitCommitHash: commitHash,
      gitCommitMessage: commitMessage,
    })
    // Display commit info here only if git pull was not run (it was already displayed after a successful git pull)
    if (!project.gitPullBeforeBuild) {
      logLine(`[T-Build] Current commit: ${commitHash.substring(0, 8)}`)
      if (commitMessage) {
        logLine(`[T-Build] Commit message: ${commitMessage}`)
      }
    }
  }

  // Load environment variables
  let projectEnv: Record<string, string> = {}
  try {
    projectEnv = await getEnvVarsForBuild(project.id)
    secretValues = Object.values(projectEnv).filter((v) => v.length >= 4)
    if (Object.keys(projectEnv).length > 0) {
      logLine(
        `[T-Build] Loaded ${Object.keys(projectEnv).length} environment variable(s)`,
      )
    }
  } catch (error) {
    logLine(
      `[T-Build] Warning: Failed to load environment variables: ${error instanceof Error ? error.message : error}`,
    )
  }

  // Parse multiline build commands
  const buildLines = project.buildCommand
    .split('\n')
    .map((cmd) => cmd.trim())
    .filter((cmd) => cmd.length > 0 && !cmd.startsWith('#'))

  if (buildLines.length === 0) {
    logLine('[T-Build] No build commands to execute')

    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    await flushLogs()

    await updateBuild(buildId, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
    })

    emitter.emit('status', 'failed')
    emitter.emit('done', { status: 'failed', error: 'No build commands' })

    setTimeout(() => cleanupBuildEmitter(buildId), 60000)
    return
  }

  // Run each build command in order, supporting directory changes with cd
  let lastExitCode: number | null = 0
  let currentDir = projectDir
  let stepCount = 0

  for (let i = 0; i < buildLines.length; i++) {
    const line = buildLines[i]

    // Handle cd commands - change the working directory for subsequent commands
    if (line.startsWith('cd ')) {
      const targetDir = line.slice(3).trim()
      const newDir = path.isAbsolute(targetDir)
        ? targetDir
        : path.resolve(currentDir, targetDir)

      // Verify that the directory exists
      try {
        const stat = await import('fs/promises').then((fs) => fs.stat(newDir))
        if (!stat.isDirectory()) {
          throw new Error('Not a directory')
        }
        currentDir = newDir
        logLine('')
        logLine(`[T-Build] Changed directory to: ${shortPath(currentDir)}`)
        continue
      } catch {
        logLine('')
        logLine(
          `[T-Build] Failed to change directory: ${newDir} does not exist`,
        )

        if (flushTimer) {
          clearTimeout(flushTimer)
          flushTimer = null
        }
        await flushLogs()

        await updateBuild(buildId, {
          status: 'failed',
          finishedAt: new Date().toISOString(),
        })

        emitter.emit('status', 'failed')
        emitter.emit('done', {
          status: 'failed',
          error: `Directory not found: ${targetDir}`,
        })

        setTimeout(() => cleanupBuildEmitter(buildId), 60000)
        return
      }
    }

    // Run a regular command
    stepCount++
    const totalSteps = buildLines.filter((l) => !l.startsWith('cd ')).length
    const stepNum = totalSteps > 1 ? ` [${stepCount}/${totalSteps}]` : ''

    logLine('')
    logLine(`[T-Build]${stepNum} Executing: ${line}`)
    if (currentDir !== projectDir) {
      logLine(`[T-Build] Working directory: ${shortPath(currentDir)}`)
    }

    const result = await executeCommand(line, currentDir, logLine, projectEnv)
    lastExitCode = result.exitCode

    if (!result.success) {
      logLine('')
      logLine(
        `[T-Build] Build failed at step ${stepCount} with exit code: ${result.exitCode}`,
      )

      if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
      }
      await flushLogs()

      await updateBuild(buildId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        exitCode: result.exitCode ?? undefined,
      })

      emitter.emit('status', 'failed')
      emitter.emit('done', { status: 'failed', exitCode: result.exitCode })

      setTimeout(() => cleanupBuildEmitter(buildId), 60000)
      return
    }
  }

  const deployLines = project.deployCommand
    ?.split('\n')
    .map((cmd) => cmd.trim())
    .filter((cmd) => cmd.length > 0 && !cmd.startsWith('#'))

  if (deployLines && deployLines.length > 0) {
    logLine('')
    logLine('[T-Build] Starting deploy')

    let deployDir = projectDir
    let deployStepCount = 0
    const totalDeploySteps = deployLines.filter(
      (line) => !line.startsWith('cd '),
    ).length

    for (const line of deployLines) {
      if (line.startsWith('cd ')) {
        const targetDir = line.slice(3).trim()
        const newDir = path.isAbsolute(targetDir)
          ? targetDir
          : path.resolve(deployDir, targetDir)

        try {
          const stat = await import('fs/promises').then((fs) => fs.stat(newDir))
          if (!stat.isDirectory()) {
            throw new Error('Not a directory')
          }
          deployDir = newDir
          logLine('')
          logLine(
            `[T-Build] Changed deploy directory to: ${shortPath(deployDir)}`,
          )
          continue
        } catch {
          logLine('')
          logLine(
            `[T-Build] Failed to change deploy directory: ${newDir} does not exist`,
          )

          if (flushTimer) {
            clearTimeout(flushTimer)
            flushTimer = null
          }
          await flushLogs()

          await updateBuild(buildId, {
            status: 'failed',
            finishedAt: new Date().toISOString(),
          })

          emitter.emit('status', 'failed')
          emitter.emit('done', {
            status: 'failed',
            error: `Deploy directory not found: ${targetDir}`,
          })

          setTimeout(() => cleanupBuildEmitter(buildId), 60000)
          return
        }
      }

      deployStepCount++
      const stepNum =
        totalDeploySteps > 1 ? ` [${deployStepCount}/${totalDeploySteps}]` : ''

      logLine('')
      logLine(`[T-Build] Deploy${stepNum} executing: ${line}`)
      if (deployDir !== projectDir) {
        logLine(`[T-Build] Deploy directory: ${shortPath(deployDir)}`)
      }

      const result = await executeCommand(line, deployDir, logLine, projectEnv)
      lastExitCode = result.exitCode

      if (!result.success) {
        logLine('')
        logLine(
          `[T-Build] Deploy failed at step ${deployStepCount} with exit code: ${result.exitCode}`,
        )

        if (flushTimer) {
          clearTimeout(flushTimer)
          flushTimer = null
        }
        await flushLogs()

        await updateBuild(buildId, {
          status: 'failed',
          finishedAt: new Date().toISOString(),
          exitCode: result.exitCode ?? undefined,
        })

        emitter.emit('status', 'failed')
        emitter.emit('done', { status: 'failed', exitCode: result.exitCode })

        setTimeout(() => cleanupBuildEmitter(buildId), 60000)
        return
      }
    }

    logLine('')
    logLine('[T-Build] Deploy success')
  }

  // All commands executed successfully
  logLine('')
  logLine(`[T-Build] Build success`)

  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  await flushLogs()

  await updateBuild(buildId, {
    status: 'success',
    finishedAt: new Date().toISOString(),
    exitCode: lastExitCode ?? 0,
  })

  emitter.emit('status', 'success')
  emitter.emit('done', { status: 'success', exitCode: lastExitCode })

  setTimeout(() => cleanupBuildEmitter(buildId), 60000)
}

export function cancelBuild(buildId: string): boolean {
  const queuedBuild = state.queue.includes(buildId)
  if (queuedBuild) {
    state.queue = state.queue.filter((id) => id !== buildId)
    for (const [projectId, queuedBuildId] of queuedProjects) {
      if (queuedBuildId === buildId) {
        queuedProjects.delete(projectId)
        break
      }
    }
    void updateBuild(buildId, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
    })
    return true
  }

  const proc = state.processes.get(buildId)
  if (proc) {
    proc.kill('SIGTERM')
    return true
  }
  return false
}
