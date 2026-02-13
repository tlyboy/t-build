import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { getSettings } from '@/lib/data/settings'

interface FileEntry {
  name: string
  path: string // 相对于工作目录的路径
  isDirectory: boolean
}

export async function GET(request: Request) {
  const settings = await getSettings()

  // 必须配置工作目录才能使用
  if (!settings.workDir) {
    return NextResponse.json(
      { error: 'Work directory not configured. Please set it in Settings.' },
      { status: 400 },
    )
  }

  const workDir = settings.workDir
  const { searchParams } = new URL(request.url)
  const relativePath = searchParams.get('path') || ''

  // 计算目标路径
  const targetPath = relativePath ? path.join(workDir, relativePath) : workDir

  // 安全检查：确保目标路径在工作目录内
  const resolvedTarget = path.resolve(targetPath)
  const resolvedWorkDir = path.resolve(workDir)

  if (!resolvedTarget.startsWith(resolvedWorkDir)) {
    return NextResponse.json(
      { error: 'Access denied: path outside work directory' },
      { status: 403 },
    )
  }

  try {
    const stat = await fs.stat(resolvedTarget)
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: 'Path is not a directory' },
        { status: 400 },
      )
    }

    const entries = await fs.readdir(resolvedTarget, { withFileTypes: true })

    const files: FileEntry[] = entries
      .filter((entry) => {
        // 过滤隐藏文件（以 . 开头）
        if (entry.name.startsWith('.')) return false
        // 过滤 node_modules
        if (entry.name === 'node_modules') return false
        // 只显示目录
        return entry.isDirectory()
      })
      .map((entry) => ({
        name: entry.name,
        path: relativePath ? `${relativePath}/${entry.name}` : entry.name,
        isDirectory: true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // 计算父目录的相对路径
    const parentPath = relativePath ? path.dirname(relativePath) : null
    const hasParent = relativePath !== ''

    return NextResponse.json({
      workDir,
      currentPath: relativePath || '/',
      parentPath: hasParent ? parentPath || '' : null,
      entries: files,
    })
  } catch {
    return NextResponse.json(
      { error: 'Cannot access directory' },
      { status: 400 },
    )
  }
}
