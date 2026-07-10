'use client'

import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { authClient } from '@/lib/auth-client'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  const t = useTranslations('nav')
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    setLoading(true)
    await authClient.signOut()
    router.push('/login')
    router.refresh()
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
