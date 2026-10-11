import { NextResponse } from 'next/server'
import { getBuildById } from '@/lib/data/builds'
import { getProjectById } from '@/lib/data/projects'
import { getSettings } from '@/lib/data/settings'
import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import fg from 'fast-glob'
import { requireApiSession } from '@/lib/auth/api'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireApiSession()
  if (unauthorized) return unauthorized

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
    return NextResponse.json({ error: 'Project has no output paths configured' }, { status: 400 })
  }

  const settings = await getSettings()
  const projectDir =
    settings.workDir && !path.isAbsolute(project.path)
      ? path.join(settings.workDir, project.path)
      : project.path

  // Collect all matching files/directories
  const validPaths: {
    fullPath: string
    archiveName: string
    isDirectory: boolean
  }[] = []

  for (const pattern of project.outputPaths) {
    // Normalize to forward slashes (fast-glob requires POSIX-style paths)
    const normalizedPattern = pattern.replace(/\\/g, '/')

    // Check whether this is a glob pattern
    const isGlob =
      normalizedPattern.includes('*') ||
      normalizedPattern.includes('?') ||
      normalizedPattern.includes('[')

    if (isGlob) {
      // Use fast-glob to match
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
        // Path traversal guard
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
      // Regular path
      const fullPath = path.isAbsolute(normalizedPattern)
        ? normalizedPattern
        : path.join(projectDir, normalizedPattern)

      // Path traversal guard
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
    return NextResponse.json({ error: 'No valid output paths found' }, { status: 404 })
  }

  // If there is only one file (not a directory), stream it directly
  if (validPaths.length === 1 && !validPaths[0].isDirectory) {
    const { fullPath } = validPaths[0]
    const filename = path.basename(fullPath)
    const stat = fs.statSync(fullPath)

    // Set the MIME type based on the extension
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

  // Package multiple files or paths containing directories into a zip (streaming)
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

  // Add all valid paths
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
