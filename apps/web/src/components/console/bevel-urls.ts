/** Production control-plane URLs for status probes and docs. */
import { BEVEL_HOME_PATH, BEVEL_PRIVATE_PATH } from '@/lib/bevel'
import { BEVEL_APEX_URL, platformPublicUrl } from '@/lib/platform'

const APEX_HOSTS = new Set([
  'bevel.is',
  'www.bevel.is',
  'app.bevel.is',
  'bevel.lvh.me',
])

function isApexHost(host: string): boolean {
  const h = host.toLowerCase().split(':')[0] || ''
  return (
    APEX_HOSTS.has(h) ||
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.startsWith('127.')
  )
}

export const bevelUrls = {
  api: () =>
    (process.env.NEXT_PUBLIC_BEVEL_API_URL || 'https://api.bevel.is').replace(/\/$/, ''),
  realtime: () =>
    (process.env.NEXT_PUBLIC_REALTIME_URL || 'https://realtime.bevel.is').replace(
      /\/$/,
      '',
    ),
  /**
   * Primary product workspace host for browser probes.
   * Prefer 2x4m workspace over apex — console status runs client-side and
   * same-origin /api/health is preferred over cross-origin bevel.is.
   */
  web: () =>
    (
      process.env.NEXT_PUBLIC_WORKSPACE_URL ||
      process.env.NEXT_PUBLIC_WEB_URL ||
      'https://bevel.2x4m.cc'
    ).replace(/\/$/, ''),
  /** Platform apex (bevel.is) — login / claim / private. */
  platformWeb: () =>
    (
      process.env.NEXT_PUBLIC_BEVEL_PUBLIC_URL ||
      BEVEL_APEX_URL
    ).replace(/\/$/, ''),
  apex: () => platformPublicUrl(),
  docs: () =>
    `${(process.env.NEXT_PUBLIC_BEVEL_API_URL || 'https://api.bevel.is').replace(/\/$/, '')}/docs`,
  graphql: () =>
    `${(process.env.NEXT_PUBLIC_BEVEL_API_URL || 'https://api.bevel.is').replace(/\/$/, '')}/graphql`,
  // Compat alias used by DECLI status page after rename
  bridge: () =>
    (process.env.NEXT_PUBLIC_BEVEL_API_URL || 'https://api.bevel.is').replace(/\/$/, ''),
  /**
   * Live fleet chat home (~general). Absolute when the console runs on the
   * platform apex (bevel.is); same-origin path when already on a workspace host.
   */
  /**
   * Leave console for product chat.
   * Apex / local → Private (`/me`). Org workspace host → `~general`.
   */
  workspaceChat: (host?: string) => {
    const resolved =
      host ||
      (typeof window !== 'undefined' ? window.location.hostname : '')
    if (isApexHost(resolved) || !resolved) return BEVEL_PRIVATE_PATH
    return BEVEL_HOME_PATH
  },
}

export const decliUrls = bevelUrls
