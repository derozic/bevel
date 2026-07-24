/** Production control-plane URLs for status probes and docs. */
export const bevelUrls = {
  api: () =>
    (process.env.NEXT_PUBLIC_BEVEL_API_URL || 'https://api.bevel.is').replace(/\/$/, ''),
  realtime: () =>
    (process.env.NEXT_PUBLIC_REALTIME_URL || 'https://realtime.bevel.is').replace(
      /\/$/,
      '',
    ),
  web: () =>
    (process.env.NEXT_PUBLIC_WEB_URL || 'https://bevel.2x4m.cc').replace(/\/$/, ''),
  docs: () =>
    `${(process.env.NEXT_PUBLIC_BEVEL_API_URL || 'https://api.bevel.is').replace(/\/$/, '')}/docs`,
  graphql: () =>
    `${(process.env.NEXT_PUBLIC_BEVEL_API_URL || 'https://api.bevel.is').replace(/\/$/, '')}/graphql`,
  // Compat alias used by DECLI status page after rename
  bridge: () =>
    (process.env.NEXT_PUBLIC_BEVEL_API_URL || 'https://api.bevel.is').replace(/\/$/, ''),
}

export const decliUrls = bevelUrls
