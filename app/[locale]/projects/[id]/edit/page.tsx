import { PageHeader } from '@/components/page-header'
import { EditProjectView } from '@/components/edit-project-view'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getProjectById } from '@/lib/data/projects'
import { getSafeSettings } from '@/lib/data/settings'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const [project, settings] = await Promise.all([
    getProjectById(id),
    getSafeSettings(),
  ])

  if (!project) {
    const t = await getTranslations('projectForm')
    return <PageHeader title={t('notFound')} backHref="/projects" />
  }

  return (
    <EditProjectView
      project={project}
      initialWorkDir={settings.workDir}
      initialCredentials={settings.gitCredentials}
    />
  )
}
