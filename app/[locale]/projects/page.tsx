'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ProjectCard } from '@/components/project-card'
import { PageHeader } from '@/components/page-header'
import { Plus, FolderGit2 } from 'lucide-react'
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-2 h-3 w-48" />
              </CardHeader>
              <CardContent className="pt-0">
                <Skeleton className="mb-4 h-16 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 sm:py-24">
          <div className="bg-primary/10 mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full">
            <FolderGit2 className="text-primary h-8 w-8" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">{t('noProjects')}</h3>
          <p className="text-muted-foreground mb-6 max-w-sm px-4 text-center text-sm">
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
