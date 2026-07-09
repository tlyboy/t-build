'use client'

import { useMemo, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Hammer, Loader2, LockKeyhole, UserRound } from 'lucide-react'

interface LoginViewProps {
  initialNeedsSetup: boolean
}

export function LoginView({ initialNeedsSetup }: LoginViewProps) {
  const t = useTranslations('auth')
  const router = useRouter()
  const [needsSetup, setNeedsSetup] = useState(initialNeedsSetup)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('T-Build')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const title = needsSetup ? t('setupTitle') : t('loginTitle')
  const description = needsSetup ? t('setupDesc') : t('loginDesc')

  const canSubmit = useMemo(
    () =>
      username.trim().length >= 3 &&
      password.length >= 8 &&
      (!needsSetup || organizationName.trim().length > 0),
    [needsSetup, organizationName, password, username],
  )

  const signInWithUsername = async () => {
    const { error } = await authClient.signIn.username({
      username: username.trim(),
      password,
    })

    if (error) {
      throw new Error(error.message || t('loginFailed'))
    }
  }

  const activateDefaultOrganization = async () => {
    const response = await fetch('/api/organizations/active', {
      method: 'POST',
    })

    if (!response.ok && response.status !== 404) {
      throw new Error(t('activeOrganizationFailed'))
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setError('')

    try {
      if (needsSetup) {
        const response = await fetch('/api/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            password,
            organizationName: organizationName.trim(),
          }),
        })

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(data?.error || t('setupFailed'))
        }

        setNeedsSetup(false)
      }

      await signInWithUsername()
      await activateDefaultOrganization()
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] w-full max-w-md items-center">
      <Card className="w-full">
        <CardHeader className="space-y-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
            <Hammer className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">{title}</CardTitle>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {needsSetup && (
              <div className="space-y-2">
                <Label htmlFor="organizationName">{t('organization')}</Label>
                <Input
                  id="organizationName"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  autoComplete="organization"
                  disabled={loading}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">{t('username')}</Label>
              <div className="relative">
                <UserRound className="text-muted-foreground pointer-events-none absolute top-2 left-2.5 h-4 w-4" />
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  className="pl-8"
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <div className="relative">
                <LockKeyhole className="text-muted-foreground pointer-events-none absolute top-2 left-2.5 h-4 w-4" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={
                    needsSetup ? 'new-password' : 'current-password'
                  }
                  className="pl-8"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!canSubmit || loading}
            >
              {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {needsSetup ? t('setupSubmit') : t('loginSubmit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
