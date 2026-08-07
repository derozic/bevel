/** Production control-plane URLs for status probes and docs. */
import { BEVEL_HOME_PATH } from '@/lib/bevel'
import { BEVEL_APEX_URL, platformPublicUrl } from '@/lib/platform'

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
  workspaceChat: () => {
    const home = BEVEL_HOME_PATH
    const workspaceBase = (
      process.env.NEXT_PUBLIC_WORKSPACE_URL ||
      process.env.NEXT_PUBLIC_WEB_URL ||
      'https://bevel.2x4m.cc'
    ).replace(/\/$/, '')
    if (typeof window === 'undefined') {
      return `${workspaceBase}${home}`
    }
    const host = window.location.hostname.toLowerCase()
    const apexHosts = new Set([
      'bevel.is',
      'www.bevel.is',
      'app.bevel.is',
      'bevel.lvh.me',
    ])
    // Stay on the current product host when the console is already there.
    if (!apexHosts.has(host) && host !== 'localhost' && !host.startsWith('127.')) {
      return home
    }
    return `${workspaceBase}${home}`
  },
}

export const decliUrls = bevelUrls
