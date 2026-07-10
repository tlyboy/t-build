import { BuildStatusBadge } from '@/components/build-status'
import { Link } from '@/i18n/navigation'
import type { BuildStatus } from '@/lib/data/builds'
import { cn } from '@/lib/utils'
import { ArrowRight, GitCommit } from 'lucide-react'

interface BuildRowProps {
  href: string
  status: BuildStatus
  projectName: string
  timeLabel: string
  dateTime?: string
  durationLabel?: string
  commitHash?: string
  commitMessage?: string
  variant?: 'plain' | 'bordered'
  className?: string
}

export function BuildRow({
  href,
  status,
  projectName,
  timeLabel,
  dateTime,
  durationLabel,
  commitHash,
  commitMessage,
  variant = 'plain',
  className,
}: BuildRowProps) {
  return (
    <Link
      href={href}
      className={cn(
        'focus-visible:ring-ring group hover:bg-muted/50 focus-visible:bg-muted/50 flex min-h-16 flex-col gap-3 px-3 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:flex-row sm:items-center sm:justify-between',
        variant === 'bordered' ? 'rounded-lg border' : 'rounded-lg',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <BuildStatusBadge status={status} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{projectName}</p>
          {commitHash && (
            <div className="text-muted-foreground mt-1 flex min-w-0 items-center gap-1.5 text-xs">
              <GitCommit className="h-3.5 w-3.5 shrink-0" />
              <code className="shrink-0">{commitHash.slice(0, 8)}</code>
              {commitMessage && (
                <span className="truncate">{commitMessage}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end sm:pl-4">
        <div className="text-left sm:text-right">
          <time
            dateTime={dateTime}
            className="text-muted-foreground block text-xs tabular-nums"
          >
            {timeLabel}
          </time>
          {durationLabel && (
            <span className="text-muted-foreground mt-0.5 block text-xs tabular-nums">
              {durationLabel}
            </span>
          )}
        </div>
        <ArrowRight
          aria-hidden="true"
          className="text-muted-foreground h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
        />
      </div>
    </Link>
  )
}
