import { SettingsView } from '@/components/settings-view'
import { setRequestLocale } from 'next-intl/server'
import { getSafeSettings } from '@/lib/data/settings'
import { getAllProjects } from '@/lib/data/projects'
import { getSafeWebhooks } from '@/lib/data/webhooks'

// 凭证列表随用户操作变化，需每次请求动态渲染
export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ from?: string | string[] }>
}) {
  const { locale } = await params
  const { from } = await searchParams
  setRequestLocale(locale)

  const backHref =
    typeof from === 'string' &&
    (from === '/projects/new' || /^\/projects\/[^/]+\/edit$/.test(from))
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
