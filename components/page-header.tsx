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
    <div className="flex items-start gap-3 mb-6">
      {backHref && (
        <Link href={backHref} className="mt-1">
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold truncate">{title}</h1>
        {description && (
          <p className="text-muted-foreground text-sm truncate">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {children}
        </div>
      )}
    </div>
  )
}
