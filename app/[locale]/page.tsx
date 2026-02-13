import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/navigation'
import { getTranslations, setRequestLocale, getLocale } from 'next-intl/server'
import {
  FolderGit2,
  Plus,
  CheckCircle2,
  Clock,
  Layers,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'

async function getStats() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  try {
    const [projectsRes, buildsRes] = await Promise.all([
      fetch(`${baseUrl}/api/projects`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/builds`, { cache: 'no-store' }),
    ])

    const projects = projectsRes.ok ? await projectsRes.json() : []
    const builds = buildsRes.ok ? await buildsRes.json() : []

    const recentBuilds = builds
      .sort((a: { startedAt: string }, b: { startedAt: string }) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      )
      .slice(0, 5)

    const successRate = builds.length > 0
      ? Math.round((builds.filter((b: { status: string }) => b.status === 'success').length / builds.length) * 100)
      : 0

    return {
      projectCount: projects.length,
      totalBuilds: builds.length,
      successBuilds: builds.filter((b: { status: string }) => b.status === 'success').length,
      failedBuilds: builds.filter((b: { status: string }) => b.status === 'failed').length,
      successRate,
      recentBuilds,
      projects,
    }
  } catch {
    return {
      projectCount: 0,
      totalBuilds: 0,
      successBuilds: 0,
      failedBuilds: 0,
      successRate: 0,
      recentBuilds: [],
      projects: [],
    }
  }
}

function formatRelativeTime(
  dateString: string,
  locale: string,
  translations: { justNow: string; minutesAgo: string; hoursAgo: string; daysAgo: string },
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

export default async function Home() {
  const locale = await getLocale()
  setRequestLocale(locale)
  const stats = await getStats()
  const t = await getTranslations('dashboard')
  const relativeTimeTranslations = {
    justNow: t('justNow'),
    minutesAgo: t.raw('minutesAgo') as string,
    hoursAgo: t.raw('hoursAgo') as string,
    daysAgo: t.raw('daysAgo') as string,
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t('description')}
          </p>
        </div>
        {stats.projectCount > 0 && (
          <Link href="/projects/new">
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              {t('newProject')}
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2 space-y-0">
            <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm">
              <FolderGit2 className="h-3.5 w-3.5" />
              {t('statProjects')}
            </CardDescription>
            <CardTitle className="text-2xl sm:text-4xl tabular-nums">
              {stats.projectCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              href="/projects"
              className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              {t('viewAll')}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 space-y-0">
            <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Layers className="h-3.5 w-3.5" />
              {t('statBuilds')}
            </CardDescription>
            <CardTitle className="text-2xl sm:text-4xl tabular-nums">
              {stats.totalBuilds}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <span className="text-xs text-muted-foreground">
              {t('allBuilds')}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 space-y-0">
            <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              {t('statSuccess')}
            </CardDescription>
            <CardTitle className="text-2xl sm:text-4xl tabular-nums text-green-600 dark:text-green-500">
              {stats.successBuilds}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <span className="text-xs text-muted-foreground">
              {t('buildSuccess')}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 space-y-0">
            <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm">
              <TrendingUp className="h-3.5 w-3.5" />
              {t('statSuccessRate')}
            </CardDescription>
            <CardTitle className="text-2xl sm:text-4xl tabular-nums">
              {stats.successRate}%
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-green-500 h-full transition-all duration-500"
                style={{ width: `${stats.successRate}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              {t('recentBuilds')}
            </CardTitle>
            {stats.recentBuilds.length > 0 && (
              <Link href="/projects">
                <Button variant="ghost" size="sm" className="text-xs">
                  {t('viewAll')}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {stats.recentBuilds.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                <Layers className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm mb-4">{t('noBuilds')}</p>
              <Link href="/projects">
                <Button variant="outline" size="sm">
                  {t('triggerBuild')}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {stats.recentBuilds.map((build: {
                id: string
                projectId: string
                status: string
                startedAt: string
              }) => {
                const project = stats.projects.find((p: { id: string }) => p.id === build.projectId)
                return (
                  <Link
                    key={build.id}
                    href={`/builds/${build.id}`}
                    className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
                        build.status === 'success'
                          ? 'bg-green-500'
                          : build.status === 'failed'
                          ? 'bg-red-500'
                          : build.status === 'running'
                          ? 'bg-yellow-500 animate-pulse'
                          : 'bg-gray-400'
                      }`} />
                      <span className="font-medium text-sm truncate">
                        {project?.name || 'Unknown'}
                      </span>
                      <Badge
                        variant={
                          build.status === 'success'
                            ? 'outline'
                            : build.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="hidden sm:inline-flex text-xs"
                      >
                        {build.status === 'success' ? t('statusSuccess') : build.status === 'failed' ? t('statusFailed') : build.status === 'running' ? t('statusRunning') : t('statusPending')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(build.startedAt, locale, relativeTimeTranslations)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {stats.projectCount === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 sm:py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <FolderGit2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('getStarted')}</h3>
            <p className="text-muted-foreground text-sm text-center mb-6 max-w-sm">
              {t('getStartedDesc')}
            </p>
            <Link href="/projects/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('createFirst')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
