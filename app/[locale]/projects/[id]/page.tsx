'use client'

import { useEffect, useState, use } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BuildStatusBadge } from '@/components/build-status'
import { EnvEditor } from '@/components/env-editor'
import { PageHeader } from '@/components/page-header'
import { Download, Play, Settings } from 'lucide-react'
import { Link, useRouter } from '@/i18n/navigation'
import { useTranslations, useLocale } from 'next-intl'

interface Project {
  id: string
  name: string
  path: string
  buildCommand: string
  createdAt: string
  updatedAt: string
  outputPaths?: string[]
}

interface Build {
  id: string
  projectId: string
  status: 'pending' | 'running' | 'success' | 'failed'
  startedAt: string
  finishedAt?: string
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const t = useTranslations('projectDetail')
  const locale = useLocale()
  const [project, setProject] = useState<Project | null>(null)
  const [builds, setBuilds] = useState<Build[]>([])
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then((res) => (res.ok ? res.json() : null)),
      fetch(`/api/builds?projectId=${id}`).then((res) => res.json()),
    ])
      .then(([proj, blds]) => {
        setProject(proj)
        setBuilds(
          blds.sort(
            (a: Build, b: Build) =>
              new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
          ),
        )
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleBuild = async () => {
    setBuilding(true)
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id }),
      })

      if (res.ok) {
        const build = await res.json()
        router.push(`/builds/${build.id}`)
      }
    } finally {
      setBuilding(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title={t('title')} backHref="/projects" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t('notFound')} backHref="/projects" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={project.name}
        description={project.path}
        backHref="/projects"
      >
        {project.outputPaths && project.outputPaths.length > 0 && (
          <Button variant="outline" asChild>
            <a href={`/api/projects/${id}/artifact`} download>
              <Download className="mr-2 h-4 w-4" />
              {t('download')}
            </a>
          </Button>
        )}
        <Link href={`/projects/${id}/edit`}>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            {t('edit')}
          </Button>
        </Link>
        <Button onClick={handleBuild} disabled={building}>
          <Play className="mr-2 h-4 w-4" />
          {building ? t('starting') : t('startBuild')}
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>{t('config')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-muted-foreground mb-1.5 text-sm">
              {t('buildCommand')}
            </div>
            <pre className="bg-muted/50 overflow-x-auto rounded-md p-3 font-mono text-sm break-all whitespace-pre-wrap">
              {project.buildCommand}
            </pre>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-muted-foreground text-sm">
                {t('createdAt')}
              </div>
              <div className="text-sm">
                {new Date(project.createdAt).toLocaleString(locale)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">
                {t('updatedAt')}
              </div>
              <div className="text-sm">
                {new Date(project.updatedAt).toLocaleString(locale)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('envVars')}</CardTitle>
          <CardDescription>{t('envVarsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <EnvEditor projectId={id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('buildHistory')}</CardTitle>
          <CardDescription>{t('recentBuilds')}</CardDescription>
        </CardHeader>
        <CardContent>
          {builds.length === 0 ? (
            <div className="text-muted-foreground text-sm">{t('noBuilds')}</div>
          ) : (
            <div className="space-y-2">
              {builds.map((build) => (
                <Link
                  key={build.id}
                  href={`/builds/${build.id}`}
                  className="hover:bg-muted flex flex-col justify-between gap-2 rounded-md border p-3 transition-colors sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-3">
                    <BuildStatusBadge status={build.status} />
                    <span className="text-muted-foreground text-sm">
                      {new Date(build.startedAt).toLocaleString(locale)}
                    </span>
                  </div>
                  {build.finishedAt && (
                    <span className="text-muted-foreground text-xs sm:text-right">
                      {t('duration', {
                        seconds: Math.round(
                          (new Date(build.finishedAt).getTime() -
                            new Date(build.startedAt).getTime()) /
                            1000,
                        ),
                      })}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
