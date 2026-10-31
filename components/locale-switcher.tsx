'use client'

import { Suspense, type ComponentProps } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Languages } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const localeLabels: Record<string, string> = {
  en: 'English',
  zh: '中文',
}

// The pathname of a dynamic route is only known at request time, so the static shell shows a disabled trigger until it streams in
export function LocaleSwitcher() {
  return (
    <Suspense fallback={<TriggerButton disabled />}>
      <LocaleMenu />
    </Suspense>
  )
}

function TriggerButton(props: ComponentProps<typeof Button>) {
  const t = useTranslations('nav')

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-10 md:size-8"
      aria-label={t('changeLanguage')}
      {...props}
    >
      <Languages className="size-4.5" />
    </Button>
  )
}

function LocaleMenu() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  function switchLocale(newLocale: string) {
    const href = `${pathname}${window.location.search}${window.location.hash}`
    router.replace(href, { locale: newLocale })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TriggerButton />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.entries(localeLabels).map(([key, label]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => switchLocale(key)}
            className={locale === key ? 'font-medium' : ''}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
