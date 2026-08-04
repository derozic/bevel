import { auth } from '@/auth'
import { bevelApiFetch } from '@/lib/bevel-api.server'
import { DEFAULT_CHANNELS, type FleetChannelSummary } from '@/lib/fleet-channels'

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
}

function asChannelSummary(raw: Record<string, unknown>): FleetChannelSummary {
  const slug = normalizeSlug(String(raw.slug ?? ''))
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => String(t)).filter(Boolean)
    : ['bevel']
  return {
    slug,
    name: String(raw.name ?? slug).trim() || slug,
    tags,
  }
}

/**
 * Channel list for the workspace rail — proxies Postgres-backed fleet API.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'Sign in required' }, { status: 401 })
  }

  try {
    const res = await bevelApiFetch('/api/v1/fleet/channels', {
      method: 'GET',
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        detail?: string
        error?: string
      }
      // Soft fallback so the rail stays usable if API is degraded
      if (res.status >= 500) {
        return Response.json({ channels: DEFAULT_CHANNELS, degraded: true })
      }
      return Response.json(
        {
          error:
            body.error ??
            (typeof body.detail === 'string' ? body.detail : undefined) ??
            `Could not load channels (${res.status})`,
        },
        { status: res.status },
      )
    }
    const data = (await res.json()) as { channels?: Record<string, unknown>[] }
    const channels = (data.channels ?? [])
      .map((c) => asChannelSummary(c))
      .filter((c) => c.slug)
    return Response.json({
      channels: channels.length > 0 ? channels : DEFAULT_CHANNELS,
    })
  } catch (e) {
    return Response.json({
      channels: DEFAULT_CHANNELS,
      degraded: true,
      detail: e instanceof Error ? e.message : 'api unreachable',
    })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'Sign in required' }, { status: 401 })
  }

  let payload: {
    slug?: string
    name?: string
    tags?: string[]
    defaultAgentIds?: string[]
  } = {}
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const slug = normalizeSlug(payload.slug ?? payload.name ?? '')
  if (!slug) {
    return Response.json({ error: 'Channel slug required' }, { status: 400 })
  }

  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((t) => String(t).trim()).filter(Boolean)
    : ['bevel']
  const defaultAgentIds =
    Array.isArray(payload.defaultAgentIds) && payload.defaultAgentIds.length > 0
      ? payload.defaultAgentIds
      : ['hermes', 'johnny']

  try {
    const res = await bevelApiFetch('/api/v1/fleet/channels', {
      method: 'POST',
      body: JSON.stringify({
        slug,
        name: payload.name?.trim() || slug,
        tags,
        defaultAgentIds,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      // Degraded path: DB role missing / 5xx — echo channel so UI can still add it
      if (res.status >= 500) {
        const channel: FleetChannelSummary = {
          slug,
          name: payload.name?.trim() || slug,
          tags,
        }
        return Response.json(
          {
            ...channel,
            channel,
            created: true,
            degraded: true,
            detail:
              (typeof data.detail === 'string' && data.detail) ||
              `upstream ${res.status}`,
          },
          { status: 201 },
        )
      }
      const detail =
        (typeof data.detail === 'string' && data.detail) ||
        (typeof data.error === 'string' && data.error) ||
        `Could not create channel (${res.status})`
      return Response.json({ error: detail, detail }, { status: res.status })
    }

    const nested =
      data.channel && typeof data.channel === 'object'
        ? (data.channel as Record<string, unknown>)
        : data
    const channel = asChannelSummary({
      slug: nested.slug ?? slug,
      name: nested.name ?? payload.name ?? slug,
      tags: nested.tags ?? tags,
    })

    // Flat + nested so older UI that reads data.slug still works
    return Response.json(
      {
        ...channel,
        channel,
        created: data.created ?? true,
      },
      { status: 201 },
    )
  } catch (e) {
    // API/DB unavailable: still accept create so the rail works offline/degraded.
    // Client merge keeps these until Postgres is healthy.
    const channel: FleetChannelSummary = {
      slug,
      name: payload.name?.trim() || slug,
      tags,
    }
    return Response.json(
      {
        ...channel,
        channel,
        created: true,
        degraded: true,
        detail: e instanceof Error ? e.message : 'api unreachable',
      },
      { status: 201 },
    )
  }
}
