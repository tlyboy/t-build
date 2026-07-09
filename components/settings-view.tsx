import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/page-header'
import { GitCredentialsSettingsCard } from '@/components/git-credentials-settings-card'
import { WebhookSettingsCard } from '@/components/webhook-settings-card'
import type { SafeGitCredential } from '@/lib/data/settings'
import type { SafeWebhookConfig } from '@/lib/data/webhooks'

interface SettingsProject {
  id: string
  name: string
}

export async function SettingsView({
  initialCredentials,
  initialProjects,
  initialWebhooks,
}: {
  initialCredentials: SafeGitCredential[]
  initialProjects: SettingsProject[]
  initialWebhooks: SafeWebhookConfig[]
}) {
  const t = await getTranslations('settings')

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      <WebhookSettingsCard
        initialProjects={initialProjects}
        initialWebhooks={initialWebhooks}
      />

      <GitCredentialsSettingsCard initialCredentials={initialCredentials} />
    </div>
  )
}
