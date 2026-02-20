'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { BuildLog } from '@/components/build-log'
import { PageHeader } from '@/components/page-header'
import { Download, GitCommit, Trash2 } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations, useLocale } from 'next-intl'

type BuildStatus = 'pending' | 'running' | 'success' | 'failed'

interface Build {
  id: string
  projectId: string
  status: 'pending' | 'running' | 'success' | 'failed'
  startedAt: string
  finishedAt?: string
  logs: string[]
  exitCode?: number
  gitCommitHash?: string
  gitCommitMessage?: string
}

interface Project {
  id: string
  name: string
  path: string
  buildCommand: string
  outputPaths?: string[]
}

export default function BuildDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const t = useTranslations('buildDetail')
  const tDelete = useTranslations('deleteBuild')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [build, setBuild] = useState<Build | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const fetchBuildData = useCallback(async () => {
    const res = await fetch(`/api/builds/${id}`)
    if (res.ok) {
      const buildData = await res.json()
      setBuild(buildData)
      if (buildData?.projectId && !project) {
        const projRes = await fetch(`/api/projects/${buildData.projectId}`)
        if (projRes.ok) {
          setProject(await projRes.json())
        }
      }
    }
  }, [id, project])

  useEffect(() => {
    fetchBuildData().finally(() => setLoading(false))
  }, [fetchBuildData])

  const handleStatusChange = useCallback(
    (status: BuildStatus) => {
      if (status === 'success' || status === 'failed') {
        fetchBuildData()
      }
    },
    [fetchBuildData],
  )

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/builds/${id}`, { method: 'DELETE' })
      if (res.ok) {
        if (project) {
          router.push(`/projects/${project.id}`)
        } else {
          router.push('/')
        }
        router.refresh()
      }
    } finally {
      setDeleting(false)
    }
  }

  const backHref = project ? `/projects/${project.id}` : '/'

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title={t('title')} backHref="/" />
      </div>
    )
  }

  if (!build) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t('notFound')} backHref="/" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t('title')}
        description={project?.name}
        backHref={backHref}
      >
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              disabled={deleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {t('delete')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tDelete('title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {tDelete('description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                {tCommon('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('buildInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground text-xs">
              {t('startTime')}
            </div>
            <div className="text-sm">
              {new Date(build.startedAt).toLocaleString(locale)}
            </div>
          </div>
          {build.finishedAt && (
            <div>
              <div className="text-muted-foreground text-xs">
                {t('endTime')}
              </div>
              <div className="text-sm">
                {new Date(build.finishedAt).toLocaleString(locale)}
              </div>
            </div>
          )}
          {build.finishedAt && (
            <div>
              <div className="text-muted-foreground text-xs">
                {t('duration')}
              </div>
              <div className="text-sm">
                {Math.round(
                  (new Date(build.finishedAt).getTime() -
                    new Date(build.startedAt).getTime()) /
                    1000,
                )}
                s
              </div>
            </div>
          )}
          {build.exitCode !== undefined && (
            <div>
              <div className="text-muted-foreground text-xs">
                {t('exitCode')}
              </div>
              <div className="text-sm">{build.exitCode}</div>
            </div>
          )}
          {build.gitCommitHash && (
            <div className="col-span-2 sm:col-span-4">
              <div className="text-muted-foreground text-xs">Git Commit</div>
              <div className="mt-0.5 flex items-center gap-2">
                <GitCommit className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                <code className="text-sm">
                  {build.gitCommitHash.substring(0, 8)}
                </code>
                {build.gitCommitMessage && (
                  <span className="text-muted-foreground truncate text-sm">
                    {build.gitCommitMessage}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {build.status === 'success' &&
        project?.outputPaths &&
        project.outputPaths.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('artifacts')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <div className="text-sm font-medium">{t('includePaths')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {project.outputPaths.map((p, i) => (
                      <code
                        key={i}
                        className="bg-muted rounded px-1.5 py-0.5 text-xs"
                      >
                        {p}
                      </code>
                    ))}
                  </div>
                </div>
                <Button asChild className="flex-shrink-0">
                  <a href={`/api/builds/${build.id}/artifact`} download>
                    <Download className="mr-2 h-4 w-4" />
                    {t('downloadArtifact')}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      <Card>
        <CardHeader>
          <CardTitle>{t('buildLog')}</CardTitle>
        </CardHeader>
        <CardContent>
          <BuildLog
            buildId={build.id}
            initialStatus={build.status}
            onStatusChange={handleStatusChange}
          />
        </CardContent>
      </Card>
    </div>
  )
}
