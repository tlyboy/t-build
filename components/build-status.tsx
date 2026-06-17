'use client'

import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'

type BuildStatus = 'pending' | 'running' | 'success' | 'failed'

const statusConfig: Record<
  BuildStatus,
  {
    key: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  pending: {
    key: 'pending',
    variant: 'secondary',
    icon: Clock,
  },
  running: {
    key: 'running',
    variant: 'default',
    icon: Loader2,
  },
  success: {
    key: 'success',
    variant: 'outline',
    icon: CheckCircle,
  },
  failed: {
    key: 'failed',
    variant: 'destructive',
    icon: XCircle,
  },
}

interface BuildStatusBadgeProps {
  status: BuildStatus
}

export function BuildStatusBadge({ status }: BuildStatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon
  const t = useTranslations('buildStatus')

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon
        className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`}
      />
      {t(config.key)}
    </Badge>
  )
}
