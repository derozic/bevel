import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@bevel/auth',
    '@bevel/tenant-config',
    '@bevel/realtime-client',
    '@bevel/ui',
    '@bevel/schema',
    '@bevel/analytics',
    '@bevel/async-stream',
  ],
}

export default nextConfig