import { PageHeader } from '@/components/page-header'
import { EditProjectView } from '@/components/edit-project-view'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getProjectById } from '@/lib/data/projects'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const project = await getProjectById(id)

  if (!project) {
    const t = await getTranslations('projectForm')
    return <PageHeader title={t('notFound')} backHref="/projects" />
  }

  return <EditProjectView project={project} />
}
