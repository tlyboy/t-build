import { NewProjectView } from '@/components/new-project-view'
import { getSafeSettings } from '@/lib/data/settings'
import { connection } from 'next/server'

export default async function NewProjectPage() {
  // Reads the local database without touching cookies, so opt into request-time rendering explicitly
  await connection()
  const settings = await getSafeSettings()

  return (
    <NewProjectView
      initialWorkDir={settings.workDir}
      initialCredentials={settings.gitCredentials}
    />
  )
}
