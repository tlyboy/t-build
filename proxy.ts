import createMiddleware from 'next-intl/middleware'
import { type NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'
import { routing } from './i18n/routing'

const handleI18nRouting = createMiddleware(routing)

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = getSessionCookie(request)
  const isLoginPage =
    pathname === '/login' ||
    routing.locales.some((locale) => pathname === `/${locale}/login`)
  const defaultLocalePrefix = `/${routing.defaultLocale}`
  const isDefaultLocaleInternalRewrite =
    request.headers.get('x-next-intl-locale') === routing.defaultLocale &&
    (pathname === defaultLocalePrefix ||
      pathname.startsWith(`${defaultLocalePrefix}/`))

  if (isDefaultLocaleInternalRewrite) {
    if (!isLoginPage && !sessionCookie) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.search = ''
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
  }

  if (!isLoginPage && !sessionCookie) {
    const loginUrl = request.nextUrl.clone()
    const locale = routing.locales.find(
      (locale) =>
        pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
    )

    loginUrl.pathname = locale ? `/${locale}/login` : '/login'
    loginUrl.search = ''
    return NextResponse.redirect(loginUrl)
  }

  return handleI18nRouting(request)
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
