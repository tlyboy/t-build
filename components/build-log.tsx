'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BuildStatusBadge } from './build-status'
import { useTranslations } from 'next-intl'

type BuildStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

interface BuildLogProps {
  buildId: string
  initialStatus?: BuildStatus
  onStatusChange?: (status: BuildStatus) => void
}

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
}

export function BuildLog({
  buildId,
  initialStatus = 'pending',
  onStatusChange,
}: BuildLogProps) {
  const t = useTranslations('buildLog')
  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<BuildStatus>(initialStatus)
  const [isLive, setIsLive] = useState(true)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const onStatusChangeRef = useRef(onStatusChange)
  const logsRef = useRef<string[]>([])
  const pendingLogsRef = useRef<string[]>([])
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getViewport = useCallback(
    () =>
      scrollAreaRef.current?.querySelector(
        '[data-slot="scroll-area-viewport"]',
      ) as HTMLElement | null,
    [],
  )

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  const flushPendingLogs = useCallback(() => {
    if (pendingLogsRef.current.length === 0) return

    const nextLogs = [...logsRef.current, ...pendingLogsRef.current]
    pendingLogsRef.current = []
    logsRef.current = nextLogs
    setLogs(nextLogs)
  }, [])

  const scheduleLogFlush = useCallback(() => {
    if (flushTimerRef.current) return

    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null
      flushPendingLogs()
    }, 100)
  }, [flushPendingLogs])

  // 视口要等第一批日志渲染出来才存在,所以用「是否已有日志」作为重新挂监听的时机。
  // 依赖数组里不能直接写表达式(静态分析看不了),提出来成变量。
  const hasLogs = logs.length > 0

  // Track user scroll to toggle sticky behavior
  useEffect(() => {
    const viewport = getViewport()
    if (!viewport) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport
      stickToBottomRef.current = scrollHeight - scrollTop - clientHeight < 50
    }

    // handler 只读滚动位置、不 preventDefault,标成 passive 让浏览器
    // 不必等它执行完再决定要不要滚
    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [getViewport, hasLogs])

  // 切换 buildId 时由父组件的 key 重新挂载本组件来重置状态,这里不再手动清空——
  // 在 effect 里同步 setState 会触发级联渲染,而且原先 initialStatus 也在依赖里,
  // 构建结束触发 router.refresh() 后会把已经收到的日志一并清掉。
  useEffect(() => {
    const es = new EventSource(`/api/builds/${buildId}/logs`)

    let logCount = 0

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as
          | { type: 'log'; data: string }
          | { type: 'status'; data: string }
          | { type: 'done'; data: { status: string; exitCode?: number } }

        switch (msg.type) {
          case 'log':
            logCount++
            // On reconnect, server resends all stored logs; skip duplicates.
            if (
              logCount >
              logsRef.current.length + pendingLogsRef.current.length
            ) {
              pendingLogsRef.current.push(stripAnsi(msg.data))
              scheduleLogFlush()
            }
            break
          case 'status': {
            const newStatus = msg.data as BuildStatus
            setStatus(newStatus)
            onStatusChangeRef.current?.(newStatus)
            break
          }
          case 'done': {
            const doneStatus = msg.data.status as BuildStatus
            flushPendingLogs()
            setStatus(doneStatus)
            onStatusChangeRef.current?.(doneStatus)
            setIsLive(false)
            es.close()
            break
          }
        }
      } catch {
        // ignore malformed messages
      }
    }

    es.onerror = () => {
      // EventSource auto-reconnects on error; only give up if build is done
      if (es.readyState === EventSource.CLOSED) {
        setIsLive(false)
      }
    }

    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      es.close()
    }
  }, [buildId, flushPendingLogs, scheduleLogFlush])

  // Smart auto-scroll: only when user is at the bottom
  useEffect(() => {
    if (!stickToBottomRef.current) return
    const raf = requestAnimationFrame(() => {
      const viewport = getViewport()
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [logs.length, getViewport])

  const isRunning = status === 'running' || status === 'pending'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <BuildStatusBadge status={status} />
        {isRunning && isLive && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            {t('liveUpdating')}
          </span>
        )}
      </div>

      <ScrollArea
        ref={scrollAreaRef}
        className="h-[55dvh] max-h-[500px] min-h-80 rounded-md border bg-muted/30"
      >
        <div className="p-4 font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-muted-foreground">
              {isRunning ? t('waitingLogs') : t('noLogs')}
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`whitespace-pre-wrap [contain-intrinsic-size:0_20px] [content-visibility:auto] ${
                  log.startsWith('[T-Build]') || log.startsWith('[git]')
                    ? 'text-blue-500'
                    : ''
                }`}
              >
                {log}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  )
}
