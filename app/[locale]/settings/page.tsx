import { SettingsView } from '@/components/settings-view'
import { setRequestLocale } from 'next-intl/server'
import { getSafeSettings } from '@/lib/data/settings'

// The credential list changes based on user actions, so it must be dynamically rendered on every request.
export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const settings = await getSafeSettings()

  return <SettingsView initialCredentials={settings.gitCredentials} />
}
