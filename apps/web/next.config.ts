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
    '@bevel/matrix',
  ],
  /**
   * Short public paths → real /bevel/* app routes.
   * Channels: `/~general` (tilde is RFC unreserved — never encoded).
   * Talk + session stay as path routes. All rewrites stay in-process (no middleware proxy).
   */
  async rewrites() {
    return [
      {
        source: '/~:slug',
        destination: '/bevel/:slug',
      },
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
        source: '/timeline',
        destination: '/bevel/timeline',
      },
      {
        // Top-level private space on bevel.is (agents only)
        source: '/me',
        destination: '/bevel/me',
      },
    ]
  },
}

export default nextConfig