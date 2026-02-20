import { getBuildById, getBuildLogs } from '@/lib/data/builds'
import { getBuildEmitter } from '@/lib/build-executor'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const build = await getBuildById(id)

  if (!build) {
    return new Response('Build not found', { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // 如果构建已完成，发送日志后关闭
      if (build.status === 'success' || build.status === 'failed') {
        const logs = await getBuildLogs(id)
        for (const log of logs) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'log', data: log })}\n\n`,
            ),
          )
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'status', data: build.status })}\n\n`,
          ),
        )
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', data: { status: build.status, exitCode: build.exitCode } })}\n\n`,
          ),
        )
        controller.close()
        return
      }

      // 构建进行中，先注册 emitter 监听器避免丢失日志
      const emitter = getBuildEmitter(id)
      const bufferedLogs: string[] = []
      let initialLogsSent = false

      const onLog = (log: string) => {
        if (initialLogsSent) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'log', data: log })}\n\n`,
            ),
          )
        } else {
          // 在发送初始日志前先缓冲
          bufferedLogs.push(log)
        }
      }

      const onStatus = (status: string) => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'status', data: status })}\n\n`,
          ),
        )
      }

      const onDone = (data: {
        status: string
        exitCode?: number
        error?: string
      }) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', data })}\n\n`),
        )
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

      // 重新读取最新状态，发送已有日志
      const latestBuild = await getBuildById(id)
      if (latestBuild) {
        const latestLogs = await getBuildLogs(id)
        for (const log of latestLogs) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'log', data: log })}\n\n`,
            ),
          )
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'status', data: latestBuild.status })}\n\n`,
          ),
        )

        // 如果在此期间构建已完成
        if (
          latestBuild.status === 'success' ||
          latestBuild.status === 'failed'
        ) {
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

      // 发送缓冲的日志
      for (const log of bufferedLogs) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'log', data: log })}\n\n`,
          ),
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
