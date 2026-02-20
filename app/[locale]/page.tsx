'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/navigation'
import { useTranslations, useLocale } from 'next-intl'
import {
  FolderGit2,
  Plus,
  CheckCircle2,
  Clock,
  Layers,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'

interface Stats {
  projectCount: number
  totalBuilds: number
  successBuilds: number
  failedBuilds: number
  successRate: number
  recentBuilds: Build[]
  projects: Project[]
}

interface Build {
  id: string
  projectId: string
  status: string
  startedAt: string
}

interface Project {
  id: string
  name: string
}

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

export default function Home() {
  const locale = useLocale()
  const t = useTranslations('dashboard')
  const tProjects = useTranslations('projects')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const relativeTimeTranslations = {
    justNow: t('justNow'),
    minutesAgo: t.raw('minutesAgo') as string,
    hoursAgo: t.raw('hoursAgo') as string,
    daysAgo: t.raw('daysAgo') as string,
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then((res) => (res.ok ? res.json() : [])),
      fetch('/api/builds').then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([projects, builds]) => {
        const recentBuilds = builds
          .sort(
            (a: Build, b: Build) =>
              new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
          )
          .slice(0, 5)

        const successRate =
          builds.length > 0
            ? Math.round(
                (builds.filter((b: Build) => b.status === 'success').length /
                  builds.length) *
                  100,
              )
            : 0

        setStats({
          projectCount: projects.length,
          totalBuilds: builds.length,
          successBuilds: builds.filter((b: Build) => b.status === 'success')
            .length,
          failedBuilds: builds.filter((b: Build) => b.status === 'failed')
            .length,
          successRate,
          recentBuilds,
          projects,
        })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {t('description')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!stats || stats.projectCount === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {t('description')}
            </p>
          </div>
        </div>
        <div className="py-12 text-center sm:py-20">
          <p className="text-muted-foreground mb-4 text-sm">
            {tProjects('noProjectsDesc')}
          </p>
          <Link href="/projects/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {tProjects('newProject')}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t('description')}
          </p>
        </div>
        <Link href="/projects/new">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            {t('newProject')}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm">
              <FolderGit2 className="h-3.5 w-3.5" />
              {t('statProjects')}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums sm:text-4xl">
              {stats.projectCount}
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
              {stats.totalBuilds}
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
              {stats.successBuilds}
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
              {stats.successRate}%
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${stats.successRate}%` }}
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
            {stats.recentBuilds.length > 0 && (
              <Link href="/projects">
                <Button variant="ghost" size="sm" className="text-xs">
                  {t('viewAll')}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {stats.recentBuilds.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t('noBuilds')}
            </p>
          ) : (
            <div className="space-y-1">
              {stats.recentBuilds.map((build) => {
                const project = stats.projects.find(
                  (p) => p.id === build.projectId,
                )
                return (
                  <Link
                    key={build.id}
                    href={`/builds/${build.id}`}
                    className="hover:bg-muted/50 group flex cursor-pointer items-center justify-between rounded-lg p-2.5 transition-colors sm:p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <div
                        className={`h-2 w-2 flex-shrink-0 rounded-full ${
                          build.status === 'success'
                            ? 'bg-green-500'
                            : build.status === 'failed'
                              ? 'bg-red-500'
                              : build.status === 'running'
                                ? 'animate-pulse bg-yellow-500'
                                : 'bg-gray-400'
                        }`}
                      />
                      <span className="truncate text-sm font-medium">
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
                        className="hidden text-xs sm:inline-flex"
                      >
                        {build.status === 'success'
                          ? t('statusSuccess')
                          : build.status === 'failed'
                            ? t('statusFailed')
                            : build.status === 'running'
                              ? t('statusRunning')
                              : t('statusPending')}
                      </Badge>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        {formatRelativeTime(
                          build.startedAt,
                          locale,
                          relativeTimeTranslations,
                        )}
                      </span>
                      <ArrowRight className="text-muted-foreground hidden h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
