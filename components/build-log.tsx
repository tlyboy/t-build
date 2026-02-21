'use client'

import { useEffect, useRef, useState } from 'react'
import { BuildStatusBadge } from './build-status'
import { useTranslations } from 'next-intl'

type BuildStatus = 'pending' | 'running' | 'success' | 'failed'

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
  const containerRef = useRef<HTMLDivElement>(null)
  const onStatusChangeRef = useRef(onStatusChange)

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  useEffect(() => {
    setLogs([])
    setStatus(initialStatus)
    setIsLive(true)

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
            setLogs((prev) => {
              // On reconnect, server resends all stored logs; skip duplicates
              if (logCount <= prev.length) return prev
              return [...prev, stripAnsi(msg.data)]
            })
            break
          case 'status': {
            const newStatus = msg.data as BuildStatus
            setStatus(newStatus)
            onStatusChangeRef.current?.(newStatus)
            break
          }
          case 'done': {
            const doneStatus = msg.data.status as BuildStatus
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
      es.close()
    }
  }, [buildId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Only auto-scroll during live builds
  useEffect(() => {
    if (!isLive) return
    const el = containerRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [logs, isLive])

  const isRunning = status === 'running' || status === 'pending'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <BuildStatusBadge status={status} />
        {isRunning && isLive && (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            {t('liveUpdating')}
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="bg-muted/30 h-[500px] overflow-y-auto rounded-md border"
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
        </div>
      </div>
    </div>
  )
}
