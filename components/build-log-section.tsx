'use client'

import { useEffect, useRef } from 'react'
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
  const logCardRef = useRef<HTMLDivElement>(null)

  // Automatically scroll to the log section after the page loads
  useEffect(() => {
    requestAnimationFrame(() => {
      logCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const handleStatusChange = (status: BuildStatus) => {
    // Refresh server-side data after the build finishes, updating the end time, exit code, and other information.
    if (status === 'success' || status === 'failed' || status === 'skipped') {
      router.refresh()
    }
  }

  return (
    <Card ref={logCardRef}>
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
