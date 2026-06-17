'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

export function StartBuildButton({ projectId }: { projectId: string }) {
  const t = useTranslations('projectDetail')
  const router = useRouter()
  const [building, setBuilding] = useState(false)

  const handleBuild = async () => {
    setBuilding(true)
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (res.ok) {
        const build = await res.json()
        router.push(`/builds/${build.id}`)
      } else {
        setBuilding(false)
      }
    } catch {
      setBuilding(false)
    }
  }

  return (
    <Button onClick={handleBuild} disabled={building}>
      <Play className="mr-2 h-4 w-4" />
      {building ? t('starting') : t('startBuild')}
    </Button>
  )
}
