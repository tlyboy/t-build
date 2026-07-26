'use client'

import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { authClient } from '@/lib/auth-client'
import { getPathname } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    setLoading(true)
    await authClient.signOut()
    window.location.replace(getPathname({ href: '/login', locale }))
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      title={t('logout')}
      aria-label={t('logout')}
      className="size-10 md:size-8"
      disabled={loading}
      onClick={handleSignOut}
    >
      {loading ? (
        <Loader2 className="size-4.5 animate-spin" />
      ) : (
        <LogOut className="size-4.5" />
      )}
    </Button>
  )
}
