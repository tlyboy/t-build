'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { Link } from '@/i18n/navigation'

interface PageHeaderProps {
  title: string
  description?: string
  backHref?: string
  children?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  backHref,
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start gap-3">
      {backHref && (
        <Link href={backHref} className="mt-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-muted-foreground truncate text-sm">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}
