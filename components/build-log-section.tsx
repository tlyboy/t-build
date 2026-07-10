'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BuildLog } from '@/components/build-log'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

type BuildStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

interface BuildLogSectionProps {
  buildId: string
  initialStatus: BuildStatus
}

export function BuildLogSection({
  buildId,
  initialStatus,
}: BuildLogSectionProps) {
  const t = useTranslations('buildDetail')
  const router = useRouter()

  const handleStatusChange = (status: BuildStatus) => {
    // 构建结束后刷新服务端数据，更新结束时间、退出码等信息
    if (status === 'success' || status === 'failed' || status === 'skipped') {
      router.refresh()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('buildLog')}</CardTitle>
      </CardHeader>
      <CardContent>
        <BuildLog
          buildId={buildId}
          initialStatus={initialStatus}
          onStatusChange={handleStatusChange}
        />
      </CardContent>
    </Card>
  )
}
