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
import { StartBuildButton } from '@/components/start-build-button'
import { Download, Settings } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { getTranslations, getLocale, setRequestLocale } from 'next-intl/server'
import { getProjectById } from '@/lib/data/projects'
import { getBuildsByProjectId } from '@/lib/data/builds'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const t = await getTranslations('projectDetail')
  const currentLocale = await getLocale()

  const [project, builds] = await Promise.all([
    getProjectById(id),
    getBuildsByProjectId(id),
  ])

  if (!project) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t('notFound')} backHref="/projects" />
      </div>
    )
  }

  const sortedBuilds = [...builds].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )

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
        <StartBuildButton projectId={id} />
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
          {project.deployCommand && (
            <div>
              <div className="text-muted-foreground mb-1.5 text-sm">
                {t('deployCommand')}
              </div>
              <pre className="bg-muted/50 overflow-x-auto rounded-md p-3 font-mono text-sm break-all whitespace-pre-wrap">
                {project.deployCommand}
              </pre>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-muted-foreground text-sm">
                {t('createdAt')}
              </div>
              <div className="text-sm">
                {new Date(project.createdAt).toLocaleString(currentLocale)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">
                {t('updatedAt')}
              </div>
              <div className="text-sm">
                {new Date(project.updatedAt).toLocaleString(currentLocale)}
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
          {sortedBuilds.length === 0 ? (
            <div className="text-muted-foreground text-sm">{t('noBuilds')}</div>
          ) : (
            <div className="space-y-2">
              {sortedBuilds.map((build) => (
                <Link
                  key={build.id}
                  href={`/builds/${build.id}`}
                  className="hover:bg-muted flex flex-col justify-between gap-2 rounded-md border p-3 transition-colors sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-3">
                    <BuildStatusBadge status={build.status} />
                    <span className="text-muted-foreground text-sm">
                      {new Date(build.startedAt).toLocaleString(currentLocale)}
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
