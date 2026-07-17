import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BuildRow } from '@/components/build-row'
import { PageHeader } from '@/components/page-header'
import { Link } from '@/i18n/navigation'
import { getTranslations, getLocale, setRequestLocale } from 'next-intl/server'
import {
  FolderGit2,
  Plus,
  CheckCircle2,
  Clock,
  Layers,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'
import { getAllProjects } from '@/lib/data/projects'
import { getAllBuilds } from '@/lib/data/builds'
import { getCurrentSession } from '@/lib/auth/server'
import { redirect } from '@/i18n/navigation'

// 数据来自本地文件且随构建实时变化，需每次请求动态渲染（避免构建时静态快照）
export const dynamic = 'force-dynamic'

function formatRelativeTime(
  dateString: string,
  locale: string,
  translations: {
    justNow: string
    minutesAgo: string
    hoursAgo: string
    daysAgo: string
  },
): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return translations.justNow
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return translations.minutesAgo.replace('{count}', String(diffInMinutes))
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return translations.hoursAgo.replace('{count}', String(diffInHours))
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return translations.daysAgo.replace('{count}', String(diffInDays))
  }

  return date.toLocaleDateString(locale)
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const session = await getCurrentSession()
  if (!session) {
    redirect({ href: '/login', locale })
  }

  const t = await getTranslations('dashboard')
  const tProjects = await getTranslations('projects')

  const [projects, builds] = await Promise.all([
    getAllProjects(),
    getAllBuilds(),
  ])

  // 单次遍历统计构建结果，避免多次 filter
  let successBuilds = 0
  let failedBuilds = 0
  for (const build of builds) {
    if (build.status === 'success') successBuilds++
    else if (build.status === 'failed') failedBuilds++
  }

  const totalBuilds = builds.length
  const executedBuilds = successBuilds + failedBuilds
  const successRate =
    executedBuilds > 0 ? Math.round((successBuilds / executedBuilds) * 100) : 0

  // 数据层已按开始时间倒序返回，直接展示最近 5 条构建记录。
  const recentBuilds = builds.slice(0, 5)

  // id -> name 查找表，避免在 map 中重复 find
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]))

  const relativeTimeTranslations = {
    justNow: t('justNow'),
    minutesAgo: t.raw('minutesAgo') as string,
    hoursAgo: t.raw('hoursAgo') as string,
    daysAgo: t.raw('daysAgo') as string,
  }

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
        <PageHeader title={t('title')} description={t('description')} />
        <div className="py-12 text-center sm:py-20">
          <p className="text-muted-foreground mb-4 text-sm">
            {tProjects('noProjectsDesc')}
          </p>
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              {tProjects('newProject')}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <PageHeader title={t('title')} description={t('description')}>
        <Button className="w-full sm:w-auto" asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('newProject')}
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm">
              <FolderGit2 className="h-3.5 w-3.5" />
              {t('statProjects')}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums sm:text-4xl">
              {projects.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              href="/projects"
              className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-xs transition-colors"
            >
              {t('viewAll')}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Layers className="h-3.5 w-3.5" />
              {t('statBuilds')}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums sm:text-4xl">
              {totalBuilds}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <span className="text-muted-foreground text-xs">
              {t('allBuilds')}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              {t('statSuccess')}
            </CardDescription>
            <CardTitle className="text-2xl text-green-600 tabular-nums sm:text-4xl dark:text-green-500">
              {successBuilds}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <span className="text-muted-foreground text-xs">
              {t('buildSuccess')}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm">
              <TrendingUp className="h-3.5 w-3.5" />
              {t('statSuccessRate')}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums sm:text-4xl">
              {successRate}%
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${successRate}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              {t('recentBuilds')}
            </CardTitle>
            {recentBuilds.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs" asChild>
                <Link href="/builds">
                  {t('viewAll')}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {recentBuilds.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t('noBuilds')}
            </p>
          ) : (
            <div className="space-y-1">
              {recentBuilds.map((build) => (
                <BuildRow
                  key={build.id}
                  status={build.status}
                  href={`/builds/${build.id}`}
                  projectName={
                    projectNameById.get(build.projectId) || t('unknownProject')
                  }
                  timeLabel={formatRelativeTime(
                    build.startedAt,
                    locale,
                    relativeTimeTranslations,
                  )}
                  dateTime={build.startedAt}
                  commitHash={build.gitCommitHash}
                  commitMessage={build.gitCommitMessage}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
