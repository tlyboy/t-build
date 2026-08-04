import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    // Rust port of the React Compiler — runs natively in Turbopack instead of
    // going through Babel, so babel-plugin-react-compiler is no longer needed.
    turbopackRustReactCompiler: true,
  },
}

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

export default withNextIntl(nextConfig)
