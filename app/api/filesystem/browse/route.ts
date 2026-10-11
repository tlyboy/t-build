import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { getSettings } from '@/lib/data/settings'
import { requireApiSession } from '@/lib/auth/api'

interface FileEntry {
  name: string
  path: string // Path relative to the working directory
  isDirectory: boolean
}

export async function GET(request: Request) {
  const unauthorized = await requireApiSession()
  if (unauthorized) return unauthorized

  const settings = await getSettings()

  // A working directory must be configured to use this
  if (!settings.workDir) {
    return NextResponse.json(
      { error: 'Work directory not configured. Please set it in Settings.' },
      { status: 400 },
    )
  }

  const workDir = settings.workDir
  const { searchParams } = new URL(request.url)
  const relativePath = searchParams.get('path') || ''

  // Calculate the target path
  const targetPath = relativePath ? path.join(workDir, relativePath) : workDir

  // Security check: ensure the target path is within the working directory
  const resolvedTarget = path.resolve(targetPath)
  const resolvedWorkDir = path.resolve(workDir)

  if (!resolvedTarget.startsWith(resolvedWorkDir)) {
    return NextResponse.json(
      { error: 'Access denied: path outside work directory' },
      { status: 403 },
    )
  }

  try {
    // Ensure the working directory exists
    await fs.mkdir(resolvedWorkDir, { recursive: true })

    const stat = await fs.stat(resolvedTarget)
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 })
    }

    const entries = await fs.readdir(resolvedTarget, { withFileTypes: true })

    const files: FileEntry[] = entries
      .filter((entry) => {
        // Filter out hidden files (starting with .)
        if (entry.name.startsWith('.')) return false
        // Filter out node_modules
        if (entry.name === 'node_modules') return false
        // Show directories only
        return entry.isDirectory()
      })
      .map((entry) => ({
        name: entry.name,
        path: relativePath ? `${relativePath}/${entry.name}` : entry.name,
        isDirectory: true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Calculate the relative path of the parent directory
    const parentPath = relativePath ? path.dirname(relativePath) : null
    const hasParent = relativePath !== ''

    return NextResponse.json({
      workDir,
      currentPath: relativePath || '/',
      parentPath: hasParent ? parentPath || '' : null,
      entries: files,
    })
  } catch {
    return NextResponse.json({ error: 'Cannot access directory' }, { status: 400 })
  }
}
