import { PageHeader } from '@/components/page-header'
import { EditProjectView } from '@/components/edit-project-view'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getProjectById } from '@/lib/data/projects'
import { getSafeSettings } from '@/lib/data/settings'
import { getSafeWebhooks } from '@/lib/data/webhooks'

export default async function EditProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ from?: string | string[] }>
}) {
  const { locale, id } = await params
  const { from } = await searchParams
  setRequestLocale(locale)

  const backHref =
    typeof from === 'string' &&
    (from === '/projects' || from === `/projects/${id}`)
      ? from
      : `/projects/${id}`

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
      backHref={backHref}
      initialWorkDir={settings.workDir}
      initialCredentials={settings.gitCredentials}
      initialWebhooks={webhooks.filter((webhook) => webhook.projectId === id)}
    />
  )
}
