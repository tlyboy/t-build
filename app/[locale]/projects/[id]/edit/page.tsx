import { PageHeader } from '@/components/page-header'
import { EditProjectView } from '@/components/edit-project-view'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getProjectById } from '@/lib/data/projects'
import { getSafeSettings } from '@/lib/data/settings'
import { getSafeWebhooks } from '@/lib/data/webhooks'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const [project, settings, webhooks] = await Promise.all([
    getProjectById(id),
    getSafeSettings(),
    getSafeWebhooks(),
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
      initialWebhooks={webhooks.filter((webhook) => webhook.projectId === id)}
    />
  )
}
