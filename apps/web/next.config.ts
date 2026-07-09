import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // Monorepo: pin tracing root so parent lockfiles do not hijack app discovery.
  outputFileTracingRoot: path.join(appDir, '../..'),
  // Allow Caddy hostnames in dev (HMR / assets).
  allowedDevOrigins: [
    'bevel.lvh.me',
    'demo.bevel.lvh.me',
    'bevel.acme.lvh.me',
    'acme.bevel.lvh.me',
    'bevel.agents.2x4m.lvh.me',
    'bevel.2ndbrain.lvh.me',
    'bevel.preso.lvh.me',
  ],
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