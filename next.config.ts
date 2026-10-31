import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ['radix-ui'],
    // Rust port of the React Compiler — runs natively in Turbopack instead of
    // going through Babel, so babel-plugin-react-compiler is no longer needed.
    turbopackRustReactCompiler: true,
  },
}

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

export default withNextIntl(nextConfig)
