'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Settings, Loader2 } from 'lucide-react'
import { Link, useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface Project {
  id: string
  name: string
  path: string
  buildCommand: string
  createdAt: string
  updatedAt: string
}

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const t = useTranslations('projectCard')
  const router = useRouter()
  const [building, setBuilding] = useState(false)

  const handleBuild = async () => {
    setBuilding(true)
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
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
    <Card className="group hover:border-primary/20 transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base sm:text-lg">
              {project.name}
            </CardTitle>
          </div>
          <Link href={`/projects/${project.id}/edit`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleBuild}
            disabled={building}
            className="flex-1 sm:flex-none"
          >
            {building ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                {t('building')}
              </>
            ) : (
              <>
                <Play className="mr-1.5 h-4 w-4" />
                {t('build')}
              </>
            )}
          </Button>
          <Link
            href={`/projects/${project.id}`}
            className="flex-1 sm:flex-none"
          >
            <Button variant="outline" size="sm" className="w-full">
              {t('detail')}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
