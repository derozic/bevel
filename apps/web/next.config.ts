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
    'bevel.2x4m.lvh.me',
    'bevel.agents.2x4m.lvh.me', // legacy redirect target still hits Next briefly
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
  /**
   * Short public paths → real /bevel/* app routes.
   * Handled here (not middleware rewrite) so Next never HTTP-proxies itself.
   * Middleware rewrite used https://localhost:41009 behind Caddy → EPROTO 500.
   *
   * Encoded caret (%5E) is what most clients send for `/^general`.
   * Middleware still covers the rare decoded `/^slug` form via redirect to %5E.
   */
  async rewrites() {
    return [
      {
        source: '/talk',
        destination: '/bevel/talk',
      },
      {
        source: '/talk/:agentId*',
        destination: '/bevel/talk/:agentId*',
      },
      {
        source: '/session/:id',
        destination: '/bevel/session/:id',
      },
      {
        source: '/%5E:slug',
        destination: '/bevel/:slug',
      },
      {
        source: '/%5e:slug',
        destination: '/bevel/:slug',
      },
    ]
  },
}

export default nextConfig