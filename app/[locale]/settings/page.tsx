import { SettingsView } from '@/components/settings-view'
import { getSafeSettings } from '@/lib/data/settings'
import { getAllProjects } from '@/lib/data/projects'
import { getSafeWebhooks } from '@/lib/data/webhooks'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>
}) {
  const { from } = await searchParams

  const backHref =
    typeof from === 'string' && (from === '/projects/new' || /^\/projects\/[^/]+\/edit$/.test(from))
      ? from
      : undefined

  const [settings, projects, webhooks] = await Promise.all([
    getSafeSettings(),
    getAllProjects(),
    getSafeWebhooks(),
  ])

  return (
    <SettingsView
      backHref={backHref}
      initialCredentials={settings.gitCredentials}
      initialProjects={projects.map((project) => ({
        id: project.id,
        name: project.name,
      }))}
      initialWebhooks={webhooks}
    />
  )
}
