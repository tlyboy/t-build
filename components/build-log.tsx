'use client'

import { useEffect, useRef, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BuildStatusBadge } from './build-status'
import { useTranslations } from 'next-intl'

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
  const [isPolling, setIsPolling] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastLogCountRef = useRef(0)
  const lastStatusRef = useRef<BuildStatus>(initialStatus)
  const onStatusChangeRef = useRef(onStatusChange)

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  useEffect(() => {
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
          return true
        }
        if (!active) return false

        const build: Build = await res.json()

        if (build.status !== lastStatusRef.current) {
          lastStatusRef.current = build.status
          setStatus(build.status)
          onStatusChangeRef.current?.(build.status)
        }

        if (build.logs.length > lastLogCountRef.current) {
          const newLogs = build.logs.slice(lastLogCountRef.current)
          setLogs((prev) => [...prev, ...newLogs.map(stripAnsi)])
          lastLogCountRef.current = build.logs.length
        }

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

    fetchLogs()

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
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            {t('liveUpdating')}
          </span>
        )}
      </div>

      <ScrollArea className="bg-muted/30 h-[500px] rounded-md border">
        <div className="p-4 font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-muted-foreground">
              {isRunning ? t('waitingLogs') : t('noLogs')}
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
