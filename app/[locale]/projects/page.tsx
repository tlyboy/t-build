import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/project-card'
import { PageHeader } from '@/components/page-header'
import { Plus } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getAllProjects } from '@/lib/data/projects'

// 项目列表随用户操作变化，需每次请求动态渲染
export const dynamic = 'force-dynamic'

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('projects')
  const projects = await getAllProjects()

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
          <Button className="w-full sm:w-auto" asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('newProject')}
            </Link>
          </Button>
        )}
      </PageHeader>

      {projects.length === 0 ? (
        <div className="py-12 text-center sm:py-20">
          <p className="text-muted-foreground mb-4 text-sm">
            {t('noProjectsDesc')}
          </p>
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('newProject')}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
