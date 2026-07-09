import { NewProjectView } from '@/components/new-project-view'
import { setRequestLocale } from 'next-intl/server'
import { getSafeSettings } from '@/lib/data/settings'

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const settings = await getSafeSettings()

  return (
    <NewProjectView
      initialWorkDir={settings.workDir}
      initialCredentials={settings.gitCredentials}
    />
  )
}
