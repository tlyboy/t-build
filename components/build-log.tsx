'use client'

import { useEffect, useRef, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BuildStatusBadge } from './build-status'

type BuildStatus = 'pending' | 'running' | 'success' | 'failed'

interface BuildLogProps {
  buildId: string
  initialStatus?: BuildStatus
  onStatusChange?: (status: BuildStatus) => void
}

interface Build {
  id: string
  status: BuildStatus
  logs: string[]
  exitCode?: number
}

// 移除 ANSI 转义码
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
}

export function BuildLog({ buildId, initialStatus = 'pending', onStatusChange }: BuildLogProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<BuildStatus>(initialStatus)
  const [isPolling, setIsPolling] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastLogCountRef = useRef(0)
  const lastStatusRef = useRef<BuildStatus>(initialStatus)
  const onStatusChangeRef = useRef(onStatusChange)

  // 保持 callback ref 最新
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  useEffect(() => {
    // 重置状态（buildId 变化时需要重新初始化）
    setLogs([]) // eslint-disable-line react-hooks/set-state-in-effect
    lastLogCountRef.current = 0
    lastStatusRef.current = initialStatus
    setIsPolling(true)
    setStatus(initialStatus)

    let active = true

    const fetchLogs = async (): Promise<boolean> => {
      if (!active) return false

      try {
        const res = await fetch(`/api/builds/${buildId}`)
        if (!res.ok) {
          console.error('Failed to fetch build:', res.status)
          return true // 继续轮询
        }
        if (!active) return false

        const build: Build = await res.json()

        // 更新状态
        if (build.status !== lastStatusRef.current) {
          lastStatusRef.current = build.status
          setStatus(build.status)
          onStatusChangeRef.current?.(build.status)
        }

        // 只有新日志时才更新
        if (build.logs.length > lastLogCountRef.current) {
          const newLogs = build.logs.slice(lastLogCountRef.current)
          setLogs(prev => [...prev, ...newLogs.map(stripAnsi)])
          lastLogCountRef.current = build.logs.length
        }

        // 构建完成后停止轮询
        if (build.status === 'success' || build.status === 'failed') {
          setIsPolling(false)
          return false
        }

        return true
      } catch (error) {
        console.error('Failed to fetch logs:', error)
        return true
      }
    }

    // 立即获取一次
    fetchLogs()

    // 设置轮询
    const poll = async () => {
      const shouldContinue = await fetchLogs()
      if (shouldContinue && active) {
        setTimeout(poll, 800)
      }
    }

    const timer = setTimeout(poll, 800)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [buildId, initialStatus])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const isRunning = status === 'running' || status === 'pending'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <BuildStatusBadge status={status} />
        {isRunning && isPolling && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            实时更新中
          </span>
        )}
      </div>

      <ScrollArea className="h-[500px] rounded-md border bg-muted/30">
        <div className="p-4 font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-muted-foreground">
              {isRunning ? '等待日志输出...' : '无日志'}
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`whitespace-pre-wrap ${
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
