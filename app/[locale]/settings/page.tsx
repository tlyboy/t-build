import { SettingsView } from '@/components/settings-view'
import { setRequestLocale } from 'next-intl/server'
import { getSafeSettings } from '@/lib/data/settings'

// 凭证列表随用户操作变化，需每次请求动态渲染
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
