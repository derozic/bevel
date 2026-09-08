import type { NextConfig } from 'next'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(appDir, '../..')
// Next only auto-loads apps/web/.env*. Pull repo-root .env so Google Workspace
// (AUTH_GOOGLE_ID/SECRET/HD) and AUTH_SECRET apply when `pnpm dev` is started
// from this package. Require (not import) so production typecheck does not
// need a direct @next/env dependency.
try {
  const { loadEnvConfig } = createRequire(import.meta.url)('@next/env') as {
    loadEnvConfig: (dir: string) => void
  }
  loadEnvConfig(repoRoot)
} catch {
  // typecheck / environments without @next/env
}

const nextConfig: NextConfig = {
  // Monorepo: pin tracing root so parent lockfiles do not hijack app discovery.
  outputFileTracingRoot: path.join(appDir, '../..'),
  // Google / OAuth profile photos (next/image). Console also uses <img> fallback.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh4.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh5.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh6.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
    ],
  },
  // Allow Caddy hostnames in dev (HMR / assets).
  allowedDevOrigins: [
    'bevel.lvh.me',
    'status.bevel.lvh.me',
    'demo.bevel.lvh.me',
    'demo.2x4m.lvh.me',
    'bevel.2x4m.lvh.me',
    'bevel.agents.2x4m.lvh.me', // legacy redirect target still hits Next briefly
    'bevel.2ndbrain.lvh.me',
    'bevel.preso.lvh.me',
    'bevel.pres0.lvh.me',
    'bevel.olimbic.lvh.me',
    'bevel.decli.lvh.me',
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
      {
        source: '/tags',
        destination: '/bevel/tags',
      },
      {
        source: '/tags/:slug',
        destination: '/bevel/tags/:slug',
      },
    ]
  },
}

export default nextConfig