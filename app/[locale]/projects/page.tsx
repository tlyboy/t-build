import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/project-card'
import { PageHeader } from '@/components/page-header'
import { Plus } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { connection } from 'next/server'
import { getAllProjects } from '@/lib/data/projects'

export default async function ProjectsPage() {
  // Reads the local database without touching cookies, so opt into request-time rendering explicitly
  await connection()

  const t = await getTranslations('projects')
  const projects = await getAllProjects()

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('title')}
        description={
          projects.length > 0 ? t('count', { count: projects.length }) : t('description')
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
          <p className="mb-4 text-sm text-muted-foreground">{t('noProjectsDesc')}</p>
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
