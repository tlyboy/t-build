import { spawn, ChildProcess, execSync } from 'child_process'
import path from 'path'
import os from 'os'
import { updateBuild, appendBuildLogs, getBuildById } from './data/builds'
import { getProjectById, Project } from './data/projects'
import { getGitCredentialById } from './data/settings'
import { EventEmitter } from 'events'

const buildEmitters = new Map<string, EventEmitter>()
const runningProcesses = new Map<string, ChildProcess>()

export function getBuildEmitter(buildId: string): EventEmitter {
  let emitter = buildEmitters.get(buildId)
  if (!emitter) {
    emitter = new EventEmitter()
    buildEmitters.set(buildId, emitter)
  }
  return emitter
}

export function cleanupBuildEmitter(buildId: string) {
  buildEmitters.delete(buildId)
}

async function executeGitPull(
  project: Project,
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

    const child = spawn('git', ['pull'], {
      cwd: project.path,
      shell: true,
      env,
    })

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
      await cleanup()
      if (code === 0) {
        const gitInfo = getGitInfo(project.path)
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
    pendingLogs.push(line)
    emitter.emit('log', line)

    if (!flushTimer) {
      flushTimer = setTimeout(async () => {
        flushTimer = null
        await flushLogs()
      }, 500)
    }
  }

  logLine(`[T-Build] Starting build for project: ${project.name}`)
  logLine(`[T-Build] Working directory: ${project.path}`)

  let commitHash: string | undefined
  let commitMessage: string | undefined

  // 如果配置了构建前 git pull
  if (project.gitPullBeforeBuild) {
    logLine('')
    const gitResult = await executeGitPull(project, buildId, logLine)
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
    const gitInfo = getGitInfo(project.path)
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
  let currentDir = project.path
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
    if (currentDir !== project.path) {
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
  const process = runningProcesses.get(buildId)
  if (process) {
    process.kill('SIGTERM')
    return true
  }
  return false
}
