import { BuildRow } from '@/components/build-row'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { getAllBuilds } from '@/lib/data/builds'
import { getAllProjects } from '@/lib/data/projects'
import { Clock3 } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

// 构建记录来自本地数据库并持续变化，需在每次请求时读取最新数据。
export const dynamic = 'force-dynamic'

export default async function BuildsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const [t, builds, projects] = await Promise.all([
    getTranslations('buildHistory'),
    getAllBuilds(),
    getAllProjects(),
  ])
  const projectNameById = new Map(
    projects.map((project) => [project.id, project.name]),
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description', { count: builds.length })}
        backHref="/"
      />

      {builds.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Clock3 className="text-muted-foreground mb-3 h-8 w-8" />
            <p className="font-medium">{t('noBuilds')}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('noBuildsDescription')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <ul className="divide-y [&>li:first-child>a]:rounded-t-xl [&>li:last-child>a]:rounded-b-xl">
              {builds.map((build) => {
                const duration = build.finishedAt
                  ? Math.round(
                      (new Date(build.finishedAt).getTime() -
                        new Date(build.startedAt).getTime()) /
                        1000,
                    )
                  : null

                return (
                  <li key={build.id}>
                    <BuildRow
                      href={`/builds/${build.id}`}
                      status={build.status}
                      projectName={
                        projectNameById.get(build.projectId) ??
                        t('unknownProject')
                      }
                      timeLabel={new Date(build.startedAt).toLocaleString(
                        locale,
                      )}
                      dateTime={build.startedAt}
                      durationLabel={
                        duration !== null
                          ? t('duration', { seconds: duration })
                          : undefined
                      }
                      commitHash={build.gitCommitHash}
                      commitMessage={build.gitCommitMessage}
                      className="rounded-none px-4"
                    />
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
