// HTTP client for 2x4m fleet channel API (hydrate + persist).

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
  status: string
  tags?: string[]
  createdAt: string
}

function apiBase(): string | null {
  return process.env.API_INTERNAL_URL ?? process.env.FLEET_CHANNEL_API_URL ?? null
}

function internalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = process.env.FLEET_INTERNAL_API_KEY
  if (key) headers['X-Fleet-Internal-Key'] = key
  return headers
}

export async function fetchChannel(slug: string): Promise<FleetChannelRecord | null> {
  const base = apiBase()
  if (!base) return null
  try {
    const res = await fetch(`${base}/api/v1/fleet/channels/${encodeURIComponent(slug)}`, {
      headers: internalHeaders(),
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
      { headers: internalHeaders() }
    )
    if (!res.ok) return []
    const data = (await res.json()) as { messages?: FleetChannelMessageRecord[] }
    return data.messages ?? []
  } catch {
    return []
  }
}

export async function appendChannelMessage(
  slug: string,
  msg: Omit<FleetChannelMessageRecord, 'createdAt'> & { createdAt?: string }
): Promise<void> {
  const base = apiBase()
  if (!base) return
  try {
    await fetch(`${base}/api/v1/fleet/channels/${encodeURIComponent(slug)}/messages`, {
      method: 'POST',
      headers: internalHeaders(),
      body: JSON.stringify(msg),
    })
  } catch {
    // Best-effort persistence; live room state remains authoritative for connected clients.
  }
}