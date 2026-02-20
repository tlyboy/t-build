import { spawn, ChildProcess, execSync } from 'child_process'
import path from 'path'
import os from 'os'
import { updateBuild, appendBuildLogs, getBuildById } from './data/builds'
import { getProjectById, Project } from './data/projects'
import { getGitCredentialById, getSettings } from './data/settings'
import { EventEmitter } from 'events'

// globalThis ensures shared state across Next.js route bundles
const g = globalThis as {
  __tbuild?: {
    emitters: Map<string, EventEmitter>
    processes: Map<string, ChildProcess>
  }
}
const state = (g.__tbuild ??= {
  emitters: new Map<string, EventEmitter>(),
  processes: new Map<string, ChildProcess>(),
})

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
}

function resolveProjectPath(workDir: string, projectPath: string): string {
  if (path.isAbsolute(projectPath)) return projectPath
  return path.join(workDir, projectPath)
}

async function executeGitPull(
  project: Project,
  projectDir: string,
  buildId: string,
  logLine: (line: string) => void,
): Promise<{ success: boolean; commitHash?: string; commitMessage?: string }> {
  const env = { ...process.env } as NodeJS.ProcessEnv
  let tempKeyPath: string | null = null

  // 如果有凭证，配置认证
  if (project.gitCredentialId) {
    const credential = await getGitCredentialById(project.gitCredentialId)
    if (credential?.type === 'ssh' && credential.sshKey) {
      // 将 SSH key 写入临时文件，统一换行符为 LF 并确保末尾有换行
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

  return new Promise((resolve) => {
    logLine('[T-Build] Executing git pull...')

    // Prevent any credential helper / SSH from hanging
    if (!env.GIT_SSH_COMMAND) {
      env.GIT_SSH_COMMAND =
        'ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no'
    }

    const child = spawn('git', ['pull'], {
      cwd: projectDir,
      shell: true,
      env: {
        ...env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: '/bin/echo',
        GIT_CONFIG_NOSYSTEM: '1',
      },
    })

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      logLine('[T-Build] Git pull timed out (30s limit)')
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

    child.on('close', async (code) => {
      clearTimeout(timer)
      await cleanup()
      if (code === 0) {
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
        resolve({
          success: true,
          commitHash: gitInfo.hash,
          commitMessage: gitInfo.message,
        })
      } else {
        logLine(`[T-Build] Git pull failed with exit code: ${code}`)
        resolve({ success: false })
      }
    })

    child.on('error', async (error) => {
      clearTimeout(timer)
      await cleanup()
      logLine(`[T-Build] Git pull error: ${error.message}`)
      resolve({ success: false })
    })
  })
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

    // 获取 commit message（第一行）
    const message = execSync('git log -1 --pretty=%s', {
      cwd: projectPath,
      encoding: 'utf-8',
    }).trim()

    return { hash, message }
  } catch {
    return {}
  }
}

// 执行单个命令的通用函数
async function executeCommand(
  command: string,
  cwd: string,
  logLine: (line: string) => void,
): Promise<{ success: boolean; exitCode: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(command, [], {
      cwd,
      shell: true,
      env: {
        ...process.env,
        FORCE_COLOR: '1',
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

  const project = await getProjectById(build.projectId)
  if (!project) {
    throw new Error(`Project ${build.projectId} not found`)
  }

  // Resolve relative project path to absolute using workDir
  const settings = await getSettings()
  const projectDir = resolveProjectPath(settings.workDir, project.path)

  const emitter = getBuildEmitter(buildId)

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

  const logLine = (line: string) => {
    // Strip project absolute path from all output
    let sanitized = line
      .replaceAll(projectDir + '/', '')
      .replaceAll(projectDir, '.')
    if (settings.workDir) {
      sanitized = sanitized
        .replaceAll(settings.workDir + '/', '')
        .replaceAll(settings.workDir, '.')
    }
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
  logLine(`[T-Build] Working directory: ${projectDir}`)

  let commitHash: string | undefined
  let commitMessage: string | undefined

  // 如果配置了构建前 git pull
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
    // 即使不 pull，也尝试获取当前 commit 信息
    const gitInfo = getGitInfo(projectDir)
    commitHash = gitInfo.hash
    commitMessage = gitInfo.message
  }

  if (commitHash) {
    await updateBuild(buildId, {
      gitCommitHash: commitHash,
      gitCommitMessage: commitMessage,
    })
    // 如果没有执行 git pull，才在这里显示 commit 信息（git pull 成功后已经显示过了）
    if (!project.gitPullBeforeBuild) {
      logLine(`[T-Build] Current commit: ${commitHash.substring(0, 8)}`)
      if (commitMessage) {
        logLine(`[T-Build] Commit message: ${commitMessage}`)
      }
    }
  }

  // 解析多行构建命令
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

  // 顺序执行每个构建命令，支持 cd 切换目录
  let lastExitCode: number | null = 0
  let currentDir = projectDir
  let stepCount = 0

  for (let i = 0; i < buildLines.length; i++) {
    const line = buildLines[i]

    // 处理 cd 命令 - 切换后续命令的工作目录
    if (line.startsWith('cd ')) {
      const targetDir = line.slice(3).trim()
      const newDir = path.isAbsolute(targetDir)
        ? targetDir
        : path.resolve(currentDir, targetDir)

      // 验证目录存在
      try {
        const stat = await import('fs/promises').then((fs) => fs.stat(newDir))
        if (!stat.isDirectory()) {
          throw new Error('Not a directory')
        }
        currentDir = newDir
        logLine('')
        logLine(`[T-Build] Changed directory to: ${currentDir}`)
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

    // 执行普通命令
    stepCount++
    const totalSteps = buildLines.filter((l) => !l.startsWith('cd ')).length
    const stepNum = totalSteps > 1 ? ` [${stepCount}/${totalSteps}]` : ''

    logLine('')
    logLine(`[T-Build]${stepNum} Executing: ${line}`)
    if (currentDir !== projectDir) {
      logLine(`[T-Build] Working directory: ${currentDir}`)
    }

    const result = await executeCommand(line, currentDir, logLine)
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

  // 所有命令执行成功
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
  const proc = state.processes.get(buildId)
  if (proc) {
    proc.kill('SIGTERM')
    return true
  }
  return false
}
