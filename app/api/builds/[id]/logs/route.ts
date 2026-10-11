import { getBuildById, getBuildLogs } from '@/lib/data/builds'
import { getBuildEmitter, getBuildMemoryLogs } from '@/lib/build-executor'
import { requireApiSession } from '@/lib/auth/api'

export const dynamic = 'force-dynamic'

function isTerminalBuildStatus(status: string) {
  return status === 'success' || status === 'failed' || status === 'skipped'
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireApiSession()
  if (unauthorized) return unauthorized

  const { id } = await params
  const build = await getBuildById(id)

  if (!build) {
    return new Response('Build not found', { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // If the build has completed, send the logs and close
      if (isTerminalBuildStatus(build.status)) {
        const logs = await getBuildLogs(id)
        for (const log of logs) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'log', data: log })}\n\n`),
          )
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'status', data: build.status })}\n\n`),
        )
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', data: { status: build.status, exitCode: build.exitCode } })}\n\n`,
          ),
        )
        controller.close()
        return
      }

      // The build is still running; register the emitter listener first to avoid missing logs
      const emitter = getBuildEmitter(id)
      const bufferedLogs: string[] = []
      let initialLogsSent = false

      const onLog = (log: string) => {
        if (initialLogsSent) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'log', data: log })}\n\n`),
          )
        } else {
          // Buffer logs before sending the initial logs
          bufferedLogs.push(log)
        }
      }

      const onStatus = (status: string) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'status', data: status })}\n\n`),
        )
      }

      const onDone = (data: { status: string; exitCode?: number; error?: string }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', data })}\n\n`))
        cleanup()
        controller.close()
      }

      const cleanup = () => {
        emitter.off('log', onLog)
        emitter.off('status', onStatus)
        emitter.off('done', onDone)
      }

      emitter.on('log', onLog)
      emitter.on('status', onStatus)
      emitter.on('done', onDone)

      request.signal.addEventListener('abort', cleanup)

      // Read the latest status again and send existing logs (prefer in-memory data to avoid missing logs due to disk flush delays)
      const latestBuild = await getBuildById(id)
      if (latestBuild) {
        const memoryLogs = getBuildMemoryLogs(id)
        const latestLogs = memoryLogs.length > 0 ? memoryLogs : await getBuildLogs(id)
        for (const log of latestLogs) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'log', data: log })}\n\n`),
          )
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'status', data: latestBuild.status })}\n\n`,
          ),
        )

        // If the build has completed in the meantime
        if (isTerminalBuildStatus(latestBuild.status)) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'done', data: { status: latestBuild.status, exitCode: latestBuild.exitCode } })}\n\n`,
            ),
          )
          cleanup()
          controller.close()
          return
        }
      }

      // Send the buffered logs
      for (const log of bufferedLogs) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'log', data: log })}\n\n`),
        )
      }
      initialLogsSent = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
