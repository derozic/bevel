/** Production control-plane URLs for status probes and docs. */
import { BEVEL_APEX_URL, platformPublicUrl } from '@/lib/platform'

export const bevelUrls = {
  api: () =>
    (process.env.NEXT_PUBLIC_BEVEL_API_URL || 'https://api.bevel.is').replace(/\/$/, ''),
  realtime: () =>
    (process.env.NEXT_PUBLIC_REALTIME_URL || 'https://realtime.bevel.is').replace(
      /\/$/,
      '',
    ),
  /** Platform apex (bevel.is) — not a product workspace host. */
  web: () =>
    (
      process.env.NEXT_PUBLIC_WEB_URL ||
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
}

export const decliUrls = bevelUrls
