'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import {
  ExternalLink,
  FolderGit2,
  History,
  Home,
  Menu,
  Settings,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

const navigationItems = [
  { href: '/', key: 'home', icon: Home },
  { href: '/projects', key: 'projects', icon: FolderGit2 },
  { href: '/builds', key: 'builds', icon: History },
  { href: '/settings', key: 'settings', icon: Settings },
] as const

function isItemActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export function DesktopNavigation() {
  const pathname = usePathname()
  const t = useTranslations('nav')

  return (
    <nav
      aria-label={t('primaryNavigation')}
      className="hidden items-center gap-1 md:flex"
    >
      {navigationItems.map(({ href, key, icon: Icon }) => {
        const active = isItemActive(pathname, href)

        return (
          <Button
            key={href}
            variant={active ? 'secondary' : 'ghost'}
            size="sm"
            asChild
          >
            <Link href={href} aria-current={active ? 'page' : undefined}>
              <Icon className="h-4 w-4" />
              {t(key)}
            </Link>
          </Button>
        )
      })}
    </nav>
  )
}

export function MobileNavigation() {
  const pathname = usePathname()
  const t = useTranslations('nav')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 md:hidden"
          aria-label={t('menu')}
        >
          <Menu className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 p-1.5">
        {navigationItems.map(({ href, key, icon: Icon }) => {
          const active = isItemActive(pathname, href)

          return (
            <DropdownMenuItem key={href} asChild>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn('min-h-10 gap-2 px-3', active && 'bg-accent')}
              >
                <Icon className="size-4" />
                {t(key)}
              </Link>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href="https://github.com/tlyboy/t-build"
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-10 gap-2 px-3"
          >
            <ExternalLink className="size-4" />
            GitHub
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
