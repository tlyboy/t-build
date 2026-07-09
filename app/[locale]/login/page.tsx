import { setRequestLocale } from 'next-intl/server'
import { LoginView } from '@/components/login-view'
import { getSqliteDatabase } from '@/lib/db/sqlite'
import { getCurrentSession } from '@/lib/auth/server'
import { redirect } from '@/i18n/navigation'

export const dynamic = 'force-dynamic'

function needsSetup() {
  const row = getSqliteDatabase()
    .prepare('select count(*) as count from user')
    .get() as { count: number }

  return row.count === 0
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const session = await getCurrentSession()
  if (session) {
    redirect({ href: '/', locale })
  }

  return <LoginView initialNeedsSetup={needsSetup()} />
}
