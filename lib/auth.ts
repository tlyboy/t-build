import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { organization } from 'better-auth/plugins/organization'
import { username } from 'better-auth/plugins/username'
import { getSqliteDatabase } from '@/lib/db/sqlite'

const devSecret = 't-build-development-secret-change-before-public-deployment'

function getAuthSecret() {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET

  if (process.env.NODE_ENV === 'production') {
    throw new Error('BETTER_AUTH_SECRET is required in production.')
  }

  return devSecret
}

function getBaseURL() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL
  if (process.env.SITE_URL) return process.env.SITE_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  return 'http://localhost:3000'
}

function getTrustedOrigins() {
  return (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export const auth = betterAuth({
  appName: 'T-Build',
  baseURL: getBaseURL(),
  secret: getAuthSecret(),
  database: getSqliteDatabase(),
  trustedOrigins: getTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
  },
  plugins: [
    username(),
    organization({
      allowUserToCreateOrganization: false,
      organizationLimit: 5,
      membershipLimit: 100,
      invitationExpiresIn: 60 * 60 * 24 * 7,
    }),
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
