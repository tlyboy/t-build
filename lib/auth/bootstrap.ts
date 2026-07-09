import { hashPassword } from 'better-auth/crypto'
import { getSqliteDatabase } from '@/lib/db/sqlite'

const USERNAME_PATTERN = /^[a-zA-Z0-9_][a-zA-Z0-9_.-]{2,29}$/

interface BootstrapInput {
  username?: string
  password?: string
  organizationName?: string
}

interface BootstrapResult {
  userId: string
  organizationId: string
}

export class BootstrapError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'default'
}

function countUsers() {
  return getSqliteDatabase()
    .prepare('select count(*) as count from user')
    .get() as { count: number }
}

export function getBootstrapStatus() {
  return {
    needsSetup: countUsers().count === 0,
  }
}

export async function bootstrapAdministrator(
  input: BootstrapInput,
): Promise<BootstrapResult> {
  const db = getSqliteDatabase()

  if (countUsers().count > 0) {
    throw new BootstrapError('Bootstrap has already been completed.', 409)
  }

  const username = input.username?.trim()
  const password = input.password ?? ''
  const organizationName = input.organizationName?.trim() || 'Default'

  if (!username || !USERNAME_PATTERN.test(username)) {
    throw new BootstrapError('Invalid username.', 400)
  }

  if (password.length < 8) {
    throw new BootstrapError('Password must be at least 8 characters.', 400)
  }

  const now = new Date().toISOString()
  const userId = crypto.randomUUID()
  const organizationId = crypto.randomUUID()
  const memberId = crypto.randomUUID()
  const accountId = crypto.randomUUID()
  const passwordHash = await hashPassword(password)

  try {
    db.transaction(() => {
      const existing = db
        .prepare('select count(*) as count from user')
        .get() as { count: number }

      if (existing.count > 0) {
        throw new Error('BOOTSTRAP_ALREADY_DONE')
      }

      // Public sign-up is disabled for the internal OSS edition, so the first
      // administrator is inserted against Better Auth's generated schema here.
      db.prepare(
        `insert into user (
          id, name, email, emailVerified, image, createdAt, updatedAt,
          username, displayUsername
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        userId,
        username,
        `${username}@local.t-build`,
        1,
        null,
        now,
        now,
        username.toLowerCase(),
        username,
      )

      db.prepare(
        `insert into account (
          id, accountId, providerId, userId, accessToken, refreshToken,
          idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope,
          password, createdAt, updatedAt
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        accountId,
        userId,
        'credential',
        userId,
        null,
        null,
        null,
        null,
        null,
        null,
        passwordHash,
        now,
        now,
      )

      db.prepare(
        `insert into organization (
          id, name, slug, logo, createdAt, metadata
        ) values (?, ?, ?, ?, ?, ?)`,
      ).run(
        organizationId,
        organizationName,
        slugify(organizationName),
        null,
        now,
        null,
      )

      db.prepare(
        `insert into member (
          id, organizationId, userId, role, createdAt
        ) values (?, ?, ?, ?, ?)`,
      ).run(memberId, organizationId, userId, 'owner', now)
    })()
  } catch (error) {
    if (error instanceof Error && error.message === 'BOOTSTRAP_ALREADY_DONE') {
      throw new BootstrapError('Bootstrap has already been completed.', 409)
    }

    throw new BootstrapError('Failed to bootstrap administrator.', 500)
  }

  return {
    userId,
    organizationId,
  }
}
