import type { Session } from 'next-auth'
import { DEFAULT_CHANNELS, type FleetChannelSummary } from '@/lib/fleet-channels'
import { resolveFleetApiToken } from '@/lib/fleet-api-auth'

// Match bevel-api.server / product-channel defaults (43203), not 2x4m's 41002.
const API_BASE =
  process.env.API_INTERNAL_URL ||
  process.env.BEVEL_API_URL ||
  process.env.NEXT_PUBLIC_BEVEL_API_URL ||
  'http://127.0.0.1:43203'

export async function fetchFleetChannels(
  sessionOrToken: Session | string | null | undefined
): Promise<FleetChannelSummary[]> {
  const apiToken =
    typeof sessionOrToken === 'string'
      ? sessionOrToken
      : await resolveFleetApiToken(sessionOrToken)
  if (!apiToken) return DEFAULT_CHANNELS

  try {
    const tenant =
      typeof sessionOrToken === 'string'
        ? undefined
        : sessionOrToken?.tenantSlug
    const qs = tenant ? `?tenant=${encodeURIComponent(tenant)}` : ''
    const res = await fetch(`${API_BASE}/api/v1/fleet/channels${qs}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      cache: 'no-store',
    })
    if (!res.ok) return DEFAULT_CHANNELS
    const data = (await res.json()) as { channels?: FleetChannelSummary[] }
    const channels = data.channels ?? []
    return channels.length > 0 ? channels : DEFAULT_CHANNELS
  } catch {
    return DEFAULT_CHANNELS
  }
}