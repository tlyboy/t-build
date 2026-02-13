import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { getGitCredentialById, getSettings } from '@/lib/data/settings'

export async function POST(request: Request) {
  const body = await request.json()

  const { gitUrl, targetPath, branch, credentialId } = body

  if (!gitUrl || !targetPath) {
    return NextResponse.json(
      { error: 'Missing required fields: gitUrl, targetPath' },
      { status: 400 },
    )
  }

  // 解析目标路径
  let resolvedTargetPath = targetPath
  if (targetPath.startsWith('~')) {
    resolvedTargetPath = targetPath.replace('~', os.homedir())
  }

  // 如果配置了工作目录且目标路径是相对路径
  const settings = await getSettings()
  if (
    settings.workDir &&
    !path.isAbsolute(targetPath) &&
    !targetPath.startsWith('~')
  ) {
    resolvedTargetPath = path.join(settings.workDir, targetPath)
  }

  // 检查目标目录是否已存在
  try {
    await fs.access(resolvedTargetPath)
    return NextResponse.json(
      { error: 'Target directory already exists' },
      { status: 400 },
    )
  } catch {
    // 目录不存在，可以继续
  }

  // 确保父目录存在
  const parentDir = path.dirname(resolvedTargetPath)
  try {
    await fs.mkdir(parentDir, { recursive: true })
  } catch {
    // 忽略已存在的情况
  }

  // 获取凭证
  let credential = null
  if (credentialId) {
    credential = await getGitCredentialById(credentialId)
  }

  // 构建环境变量
  const env = { ...process.env } as NodeJS.ProcessEnv

  // 处理 Git URL 和认证
  let cloneUrl = gitUrl

  if (credential) {
    if (
      credential.type === 'https' &&
      credential.username &&
      credential.password
    ) {
      // HTTPS 认证：将凭证嵌入 URL
      try {
        const url = new URL(gitUrl)
        url.username = encodeURIComponent(credential.username)
        url.password = encodeURIComponent(credential.password)
        cloneUrl = url.toString()
      } catch {
        // URL 解析失败，使用原始 URL
      }
    } else if (credential.type === 'ssh' && credential.sshKey) {
      // SSH 认证：将密钥写入临时文件，统一换行符为 LF
      const tempKeyPath = path.join(os.tmpdir(), `git-ssh-key-${Date.now()}`)
      const normalizedKey =
        credential.sshKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim() +
        '\n'
      await fs.writeFile(tempKeyPath, normalizedKey, { mode: 0o600 })
      env.GIT_SSH_COMMAND = `ssh -i "${tempKeyPath}" -o StrictHostKeyChecking=no`
      // 克隆完成后删除临时文件
      setTimeout(() => fs.unlink(tempKeyPath).catch(() => {}), 60000)
    }
  }

  // 构建 git clone 命令
  const args = ['clone']
  if (branch) {
    args.push('-b', branch)
  }
  args.push(cloneUrl, resolvedTargetPath)

  return new Promise<Response>((resolve) => {
    const logs: string[] = []
    const child = spawn('git', args, { env })

    child.stdout?.on('data', (data: Buffer) => {
      logs.push(data.toString())
    })

    child.stderr?.on('data', (data: Buffer) => {
      // 过滤掉可能包含凭证的输出
      const output = data
        .toString()
        .replace(/https:\/\/[^@]+@/g, 'https://***@')
      logs.push(output)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(
          NextResponse.json({
            success: true,
            path: resolvedTargetPath,
            logs: logs.join(''),
          }),
        )
      } else {
        resolve(
          NextResponse.json(
            {
              error: 'Git clone failed',
              logs: logs.join(''),
            },
            { status: 500 },
          ),
        )
      }
    })

    child.on('error', (error) => {
      resolve(
        NextResponse.json(
          {
            error: `Git clone error: ${error.message}`,
          },
          { status: 500 },
        ),
      )
    })
  })
}
