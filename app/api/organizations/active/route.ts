import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getSqliteDatabase } from '@/lib/db/sqlite'

export const runtime = 'nodejs'

interface UserOrganization {
  id: string
  name: string
  slug: string
}

function findUserOrganization(userId: string, organizationId?: string) {
  const db = getSqliteDatabase()

  if (organizationId) {
    return db
      .prepare(
        `select organization.id, organization.name, organization.slug
        from organization
        inner join member on member.organizationId = organization.id
        where member.userId = ? and organization.id = ?
        limit 1`,
      )
      .get(userId, organizationId) as UserOrganization | undefined
  }

  return db
    .prepare(
      `select organization.id, organization.name, organization.slug
      from organization
      inner join member on member.organizationId = organization.id
      where member.userId = ?
      order by member.createdAt asc, organization.createdAt asc
      limit 1`,
    )
    .get(userId) as UserOrganization | undefined
}

export async function POST() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const currentOrganizationId =
    session.session.activeOrganizationId ?? undefined
  const organization =
    findUserOrganization(session.user.id, currentOrganizationId) ??
    findUserOrganization(session.user.id)

  if (!organization) {
    return NextResponse.json(
      { error: 'No organization available for this user.' },
      { status: 404 },
    )
  }

  if (currentOrganizationId !== organization.id) {
    await auth.api.setActiveOrganization({
      headers: requestHeaders,
      body: {
        organizationId: organization.id,
      },
    })
  }

  return NextResponse.json({
    organization,
  })
}
