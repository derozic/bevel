import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@bevel/ui', '@bevel/schema', '@bevel/tenant-config', '@bevel/auth'],
}

export default nextConfig