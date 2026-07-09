/** Client-safe fleet channel types and defaults. */

export type FleetChannelSummary = {
  slug: string
  name: string
  tags: string[]
}

export const DEFAULT_CHANNELS: FleetChannelSummary[] = [
  {
    slug: 'general',
    name: 'General',
    tags: ['bevel', 'general'],
  },
]