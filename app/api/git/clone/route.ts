import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { getGitCredentialById, getSettings } from '@/lib/data/settings'
import { requireApiSession } from '@/lib/auth/api'

export async function POST(request: Request) {
  const unauthorized = await requireApiSession()
  if (unauthorized) return unauthorized

  const body = await request.json()

  const { gitUrl, targetPath, branch, credentialId } = body

  if (!gitUrl || !targetPath) {
    return NextResponse.json(
      { error: 'Missing required fields: gitUrl, targetPath' },
      { status: 400 },
    )
  }

  // Validate branch name to prevent argument injection
  if (branch && !/^[\w.\-/]+$/.test(branch)) {
    return NextResponse.json({ error: 'Invalid branch name' }, { status: 400 })
  }

  // Resolve the target path
  let resolvedTargetPath = targetPath
  if (targetPath.startsWith('~')) {
    resolvedTargetPath = targetPath.replace('~', os.homedir())
  }

  // If a working directory is configured and the target path is relative
  const settings = await getSettings()
  if (settings.workDir && !path.isAbsolute(targetPath) && !targetPath.startsWith('~')) {
    resolvedTargetPath = path.join(settings.workDir, targetPath)
  }

  // Security check: ensure the target path is inside the working directory
  if (settings.workDir) {
    const resolved = path.resolve(resolvedTargetPath)
    const workDir = path.resolve(settings.workDir)
    if (!resolved.startsWith(workDir + path.sep) && resolved !== workDir) {
      return NextResponse.json(
        { error: 'Target path must be within work directory' },
        { status: 400 },
      )
    }
  }

  // Check whether the target directory already exists
  try {
    await fs.access(resolvedTargetPath)
    return NextResponse.json({ error: 'Target directory already exists' }, { status: 400 })
  } catch {
    // The directory does not exist, so we can continue
  }

  // Ensure the parent directory exists
  const parentDir = path.dirname(resolvedTargetPath)
  try {
    await fs.mkdir(parentDir, { recursive: true })
  } catch {
    // Ignore the case where it already exists
  }

  // Get the credentials
  let credential = null
  if (credentialId) {
    credential = await getGitCredentialById(credentialId)
  }

  // Build the environment variables
  const env = { ...process.env } as NodeJS.ProcessEnv

  // Handle the Git URL and authentication
  let cloneUrl = gitUrl

  if (credential) {
    if (credential.type === 'https' && credential.username && credential.password) {
      // HTTPS authentication: embed the credentials in the URL
      try {
        const url = new URL(gitUrl)
        url.username = encodeURIComponent(credential.username)
        url.password = encodeURIComponent(credential.password)
        cloneUrl = url.toString()
      } catch {
        // URL parsing failed; use the original URL
      }
    } else if (credential.type === 'ssh' && credential.sshKey) {
      // SSH authentication: write the key to a temporary file and normalize line endings to LF
      const tempKeyPath = path.join(os.tmpdir(), `git-ssh-key-${Date.now()}`)
      const normalizedKey =
        credential.sshKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim() + '\n'
      await fs.writeFile(tempKeyPath, normalizedKey, { mode: 0o600 })
      env.GIT_SSH_COMMAND = `ssh -i "${tempKeyPath}" -o StrictHostKeyChecking=no`
      // Delete the temporary file after cloning completes
      setTimeout(() => fs.unlink(tempKeyPath).catch(() => {}), 60000)
    }
  }

  // Build the git clone command
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
      // Filter out output that may contain credentials
      const output = data.toString().replace(/https:\/\/[^@]+@/g, 'https://***@')
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
