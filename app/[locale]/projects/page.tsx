'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/project-card'
import { PageHeader } from '@/components/page-header'
import { Plus } from 'lucide-react'
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

export default function ProjectsPage() {
  const router = useRouter()
  const t = useTranslations('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [buildingId, setBuildingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [])

  const handleBuild = async (projectId: string) => {
    setBuildingId(projectId)
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (res.ok) {
        const build = await res.json()
        router.push(`/builds/${build.id}`)
      }
    } finally {
      setBuildingId(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t('title')} description={t('description')} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('title')}
        description={
          projects.length > 0
            ? t('count', { count: projects.length })
            : t('description')
        }
      >
        {projects.length > 0 && (
          <Link href="/projects/new">
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              {t('newProject')}
            </Button>
          </Link>
        )}
      </PageHeader>

      {projects.length === 0 ? (
        <div className="py-12 text-center sm:py-20">
          <p className="text-muted-foreground mb-4 text-sm">
            {t('noProjectsDesc')}
          </p>
          <Link href="/projects/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('newProject')}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onBuild={handleBuild}
              building={buildingId === project.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
