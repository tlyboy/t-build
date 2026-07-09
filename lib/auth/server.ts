import { headers } from 'next/headers'
import { cache } from 'react'
import { auth } from '@/lib/auth'

export const getCurrentSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  })
})

export async function requireCurrentSession() {
  const session = await getCurrentSession()

  if (!session) {
    throw new Error('Unauthorized')
  }

  return session
}

export const getCurrentOrganizations = cache(async () => {
  return auth.api.listOrganizations({
    headers: await headers(),
  })
})
