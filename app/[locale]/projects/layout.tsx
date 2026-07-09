import { getCurrentSession } from '@/lib/auth/server'
import { redirect } from '@/i18n/navigation'

export default async function ProjectsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, session] = await Promise.all([params, getCurrentSession()])
  if (!session) {
    redirect({ href: '/login', locale })
  }

  return children
}
