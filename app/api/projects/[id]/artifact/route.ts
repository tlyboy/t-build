import { NextResponse } from 'next/server'
import { getProjectById } from '@/lib/data/projects'
import { getSettings } from '@/lib/data/settings'
import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import fg from 'fast-glob'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const project = await getProjectById(id)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (!project.outputPaths || project.outputPaths.length === 0) {
    return NextResponse.json(
      { error: 'Project has no output paths configured' },
      { status: 400 },
    )
  }

  const settings = await getSettings()
  const projectDir =
    settings.workDir && !path.isAbsolute(project.path)
      ? path.join(settings.workDir, project.path)
      : project.path

  // 收集所有匹配的文件/目录
  const validPaths: {
    fullPath: string
    archiveName: string
    isDirectory: boolean
  }[] = []

  for (const pattern of project.outputPaths) {
    const normalizedPattern = pattern.replace(/\\/g, '/')

    const isGlob =
      normalizedPattern.includes('*') ||
      normalizedPattern.includes('?') ||
      normalizedPattern.includes('[')

    if (isGlob) {
      const matches = await fg(normalizedPattern, {
        cwd: projectDir,
        absolute: true,
        onlyFiles: false,
        markDirectories: true,
      })

      const resolvedProjectDir = path.resolve(projectDir)
      for (const match of matches) {
        const fullPath = match.endsWith('/') ? match.slice(0, -1) : match
        const resolvedFull = path.resolve(fullPath)
        if (
          !resolvedFull.startsWith(resolvedProjectDir + path.sep) &&
          resolvedFull !== resolvedProjectDir
        ) {
          continue
        }
        const relativePath = path.relative(projectDir, fullPath)

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
      const fullPath = path.isAbsolute(normalizedPattern)
        ? normalizedPattern
        : path.join(projectDir, normalizedPattern)

      const resolvedFull = path.resolve(fullPath)
      const resolvedProjectDir = path.resolve(projectDir)
      if (
        !resolvedFull.startsWith(resolvedProjectDir + path.sep) &&
        resolvedFull !== resolvedProjectDir
      ) {
        continue
      }

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

  // 如果只有一个文件（非目录），直接流式返回
  if (validPaths.length === 1 && !validPaths[0].isDirectory) {
    const { fullPath } = validPaths[0]
    const filename = path.basename(fullPath)
    const stat = fs.statSync(fullPath)

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

    const nodeStream = fs.createReadStream(fullPath)
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(chunk))
        nodeStream.on('end', () => controller.close())
        nodeStream.on('error', (err) => controller.error(err))
      },
    })

    return new Response(webStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': stat.size.toString(),
      },
    })
  }

  // 多个文件或包含目录，打包成 zip（流式传输）
  const archive = archiver('zip', {
    zlib: { level: 9 },
  })

  const filename = `${project.name}.zip`

  const webStream = new ReadableStream({
    start(controller) {
      archive.on('data', (chunk) => controller.enqueue(chunk))
      archive.on('end', () => controller.close())
      archive.on('error', (err) => controller.error(err))
    },
  })

  for (const { fullPath, archiveName, isDirectory } of validPaths) {
    if (isDirectory) {
      archive.directory(fullPath, archiveName)
    } else {
      archive.file(fullPath, { name: archiveName })
    }
  }

  archive.finalize()

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  })
}
