import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react'

type BuildStatus = 'pending' | 'running' | 'success' | 'failed'

const statusConfig: Record<BuildStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
  pending: {
    label: '等待中',
    variant: 'secondary',
    icon: Clock,
  },
  running: {
    label: '构建中',
    variant: 'default',
    icon: Loader2,
  },
  success: {
    label: '成功',
    variant: 'outline',
    icon: CheckCircle,
  },
  failed: {
    label: '失败',
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

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  )
}
