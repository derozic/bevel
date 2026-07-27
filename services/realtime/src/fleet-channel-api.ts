// HTTP client for BEVEL fleet channel API (hydrate + durable Postgres persist).

export type FleetChannelRecord = {
  slug: string
  name: string
  description?: string
  tags: string[]
  defaultAgentIds: string[]
}

export type FleetChannelMessageRecord = {
  id: string
  speakerId: string
  speakerName: string
  speakerAvatar?: string
  speakerType: string
  agentId?: string
  body: string
  /** pending | streaming | final | error */
  status: string
  tags?: string[]
  createdAt: string
}

const PERSIST_TIMEOUT_MS = 8_000
const PERSIST_RETRIES = 3

function apiBase(): string | null {
  return process.env.API_INTERNAL_URL ?? process.env.FLEET_CHANNEL_API_URL ?? null
}

function internalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = process.env.FLEET_INTERNAL_API_KEY
  if (key) headers['X-Fleet-Internal-Key'] = key
  return headers
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

export async function fetchChannel(slug: string): Promise<FleetChannelRecord | null> {
  const base = apiBase()
  if (!base) return null
  try {
    const res = await fetch(`${base}/api/v1/fleet/channels/${encodeURIComponent(slug)}`, {
      headers: internalHeaders(),
      signal: AbortSignal.timeout(PERSIST_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = (await res.json()) as FleetChannelRecord & { default_agent_ids?: string[] }
    return {
      slug: data.slug,
      name: data.name,
      description: data.description,
      tags: data.tags ?? [],
      defaultAgentIds: data.defaultAgentIds ?? data.default_agent_ids ?? ['hermes', 'johnny'],
    }
  } catch {
    return null
  }
}

export async function fetchChannelMessages(
  slug: string,
  limit = 100
): Promise<FleetChannelMessageRecord[]> {
  const base = apiBase()
  if (!base) return []
  try {
    const res = await fetch(
      `${base}/api/v1/fleet/channels/${encodeURIComponent(slug)}/messages?limit=${limit}`,
      {
        headers: internalHeaders(),
        signal: AbortSignal.timeout(PERSIST_TIMEOUT_MS),
      }
    )
    if (!res.ok) return []
    const data = (await res.json()) as { messages?: FleetChannelMessageRecord[] }
    return data.messages ?? []
  } catch {
    return []
  }
}

/**
 * Durable upsert of a channel message to Postgres via the control-plane API.
 * Retries with backoff so in-progress and final turns are not lost on blips.
 * Returns true when the API accepted the write.
 */
export async function appendChannelMessage(
  slug: string,
  msg: Omit<FleetChannelMessageRecord, 'createdAt'> & { createdAt?: string }
): Promise<boolean> {
  const base = apiBase()
  if (!base) {
    console.warn('[fleet-channel-api] no API_INTERNAL_URL — message not persisted', {
      slug,
      id: msg.id,
    })
    return false
  }

  const url = `${base}/api/v1/fleet/channels/${encodeURIComponent(slug)}/messages`
  let lastErr = 'unknown'
  for (let attempt = 1; attempt <= PERSIST_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: internalHeaders(),
        body: JSON.stringify(msg),
        signal: AbortSignal.timeout(PERSIST_TIMEOUT_MS),
      })
      if (res.ok) return true
      lastErr = `HTTP ${res.status}`
      // 4xx (except 408/429) are not retried
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        console.error('[fleet-channel-api] persist rejected', {
          slug,
          id: msg.id,
          status: res.status,
        })
        return false
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
    if (attempt < PERSIST_RETRIES) {
      await sleep(150 * attempt * attempt)
    }
  }
  console.error('[fleet-channel-api] persist failed after retries', {
    slug,
    id: msg.id,
    status: msg.status,
    error: lastErr,
  })
  return false
}
