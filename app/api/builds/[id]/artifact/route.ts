import { NextResponse } from 'next/server'
import { getBuildById } from '@/lib/data/builds'
import { getProjectById } from '@/lib/data/projects'
import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import fg from 'fast-glob'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const build = await getBuildById(id)
  if (!build) {
    return NextResponse.json({ error: 'Build not found' }, { status: 404 })
  }

  if (build.status !== 'success') {
    return NextResponse.json(
      { error: 'Can only download artifacts from successful builds' },
      { status: 400 },
    )
  }

  const project = await getProjectById(build.projectId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (!project.outputPaths || project.outputPaths.length === 0) {
    return NextResponse.json(
      { error: 'Project has no output paths configured' },
      { status: 400 },
    )
  }

  // 收集所有匹配的文件/目录
  const validPaths: {
    fullPath: string
    archiveName: string
    isDirectory: boolean
  }[] = []

  for (const pattern of project.outputPaths) {
    // 统一使用正斜杠（fast-glob 要求 POSIX 风格路径）
    const normalizedPattern = pattern.replace(/\\/g, '/')

    // 检查是否是 glob 模式
    const isGlob =
      normalizedPattern.includes('*') ||
      normalizedPattern.includes('?') ||
      normalizedPattern.includes('[')

    if (isGlob) {
      // 使用 fast-glob 匹配
      const matches = await fg(normalizedPattern, {
        cwd: project.path,
        absolute: true,
        onlyFiles: false,
        markDirectories: true,
      })

      for (const match of matches) {
        const fullPath = match.endsWith('/') ? match.slice(0, -1) : match
        const relativePath = path.relative(project.path, fullPath)

        try {
          const stat = fs.statSync(fullPath)
          validPaths.push({
            fullPath,
            archiveName: relativePath,
            isDirectory: stat.isDirectory(),
          })
        } catch {
          continue
        }
      }
    } else {
      // 普通路径
      const fullPath = path.isAbsolute(normalizedPattern)
        ? normalizedPattern
        : path.join(project.path, normalizedPattern)

      try {
        const stat = fs.statSync(fullPath)
        validPaths.push({
          fullPath,
          archiveName: normalizedPattern,
          isDirectory: stat.isDirectory(),
        })
      } catch {
        continue
      }
    }
  }

  if (validPaths.length === 0) {
    return NextResponse.json(
      { error: 'No valid output paths found' },
      { status: 404 },
    )
  }

  // 如果只有一个文件（非目录），直接返回该文件
  if (validPaths.length === 1 && !validPaths[0].isDirectory) {
    const { fullPath } = validPaths[0]
    const filename = path.basename(fullPath)
    const buffer = fs.readFileSync(fullPath)

    // 根据扩展名设置 MIME 类型
    const ext = path.extname(filename).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.dmg': 'application/x-apple-diskimage',
      '.exe': 'application/x-msdownload',
      '.msi': 'application/x-msi',
      '.appimage': 'application/x-executable',
      '.deb': 'application/vnd.debian.binary-package',
      '.rpm': 'application/x-rpm',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
      '.zip': 'application/zip',
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  }

  // 多个文件或包含目录，打包成 zip
  const archive = archiver('zip', {
    zlib: { level: 9 },
  })

  const chunks: Buffer[] = []

  return new Promise<Response>((resolve) => {
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    archive.on('end', () => {
      const buffer = Buffer.concat(chunks)
      const filename = `${project.name}-${build.id.substring(0, 8)}.zip`

      resolve(
        new Response(buffer, {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            'Content-Length': buffer.length.toString(),
          },
        }),
      )
    })

    archive.on('error', (err) => {
      resolve(
        NextResponse.json(
          { error: `Archive error: ${err.message}` },
          { status: 500 },
        ),
      )
    })

    // 添加所有有效路径
    for (const { fullPath, archiveName, isDirectory } of validPaths) {
      if (isDirectory) {
        archive.directory(fullPath, archiveName)
      } else {
        archive.file(fullPath, { name: archiveName })
      }
    }

    archive.finalize()
  })
}
