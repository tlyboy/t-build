import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import { BuildLogSection } from '@/components/build-log-section'
import { DeleteBuildButton } from '@/components/delete-build-button'
import { GitCommit } from 'lucide-react'
import { getTranslations, getLocale, setRequestLocale } from 'next-intl/server'
import { getBuildById } from '@/lib/data/builds'
import { getProjectById } from '@/lib/data/projects'

export default async function BuildDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const t = await getTranslations('buildDetail')
  const currentLocale = await getLocale()

  const build = await getBuildById(id)

  if (!build) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t('notFound')} backHref="/" />
      </div>
    )
  }

  // build.projectId 来自 build，是真实数据依赖，服务端直读已消除 HTTP 往返
  const project = build.projectId
    ? await getProjectById(build.projectId)
    : null

  const backHref = project ? `/projects/${project.id}` : '/'

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t('title')}
        description={project?.name}
        backHref={backHref}
      >
        <DeleteBuildButton buildId={build.id} projectId={project?.id ?? null} />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('buildInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground text-xs">{t('startTime')}</div>
            <div className="text-sm">
              {new Date(build.startedAt).toLocaleString(currentLocale)}
            </div>
          </div>
          {build.finishedAt && (
            <div>
              <div className="text-muted-foreground text-xs">{t('endTime')}</div>
              <div className="text-sm">
                {new Date(build.finishedAt).toLocaleString(currentLocale)}
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

      <BuildLogSection buildId={build.id} initialStatus={build.status} />
    </div>
  )
}
