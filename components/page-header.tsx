'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { Link, useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface PageHeaderProps {
  title: string
  description?: string
  backHref?: string
  backBehavior?: 'link' | 'history'
  children?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  backHref,
  backBehavior = 'link',
  children,
}: PageHeaderProps) {
  const t = useTranslations('common')
  const router = useRouter()

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
      return
    }

    if (backHref) {
      router.push(backHref)
    }
  }

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-14 z-40 -mx-4 mb-6 flex flex-col gap-3 border-b px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:gap-4 sm:py-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {backHref &&
          (backBehavior === 'history' ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 sm:mt-0.5 sm:size-8"
              aria-label={t('back')}
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">{t('back')}</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 sm:mt-0.5 sm:size-8"
              asChild
            >
              <Link href={backHref} aria-label={t('back')}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">{t('back')}</span>
              </Link>
            </Button>
          ))}
        <div className="min-w-0 flex-1 pt-1 sm:pt-0">
          <h1 className="text-2xl leading-tight font-bold break-words">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-sm break-all">
              {description}
            </p>
          )}
        </div>
      </div>
      {children && (
        <div className="flex w-full flex-wrap items-center gap-2 pl-0 sm:w-auto sm:shrink-0 sm:justify-end">
          {children}
        </div>
      )}
    </header>
  )
}
