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
  reactions?: Array<{
    kind: string
    userId: string
    userName?: string
    ts?: number
  }>
  votePrompt?: string | null
  voteRequired?: boolean
}

export type ChannelMessagesPage = {
  messages: FleetChannelMessageRecord[]
  hasMore: boolean
  nextBefore: string | null
  nextBeforeId: string | null
  limit: number
}

export type FetchMessagesOpts = {
  limit?: number
  before?: string | null
  beforeId?: string | null
  tenant?: string | null
}

const PERSIST_TIMEOUT_MS = 8_000
const PERSIST_RETRIES = 5

function apiBase(): string | null {
  const explicit =
    process.env.API_INTERNAL_URL ?? process.env.FLEET_CHANNEL_API_URL ?? ''
  if (explicit.trim()) return explicit.trim()
  // Local stack default — production must set API_INTERNAL_URL explicitly.
  if (process.env.NODE_ENV !== 'production') return 'http://127.0.0.1:43203'
  return null
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

function withTenant(path: string, tenant?: string | null): string {
  if (!tenant) return path
  const join = path.includes('?') ? '&' : '?'
  return `${path}${join}tenant=${encodeURIComponent(tenant)}`
}

export async function fetchChannel(
  slug: string,
  tenant?: string | null,
): Promise<FleetChannelRecord | null> {
  const base = apiBase()
  if (!base) return null
  try {
    const res = await fetch(
      `${base}${withTenant(`/api/v1/fleet/channels/${encodeURIComponent(slug)}`, tenant)}`,
      {
      headers: internalHeaders(),
      signal: AbortSignal.timeout(PERSIST_TIMEOUT_MS),
    },
    )
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

/** Fetch one page of channel history (newest page when before is omitted). */
export async function fetchChannelMessagesPage(
  slug: string,
  opts: FetchMessagesOpts = {},
): Promise<ChannelMessagesPage> {
  const base = apiBase()
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500))
  const empty: ChannelMessagesPage = {
    messages: [],
    hasMore: false,
    nextBefore: null,
    nextBeforeId: null,
    limit,
  }
  if (!base) return empty
  try {
    const params = new URLSearchParams({ limit: String(limit) })
    if (opts.before) params.set('before', opts.before)
    if (opts.beforeId) params.set('before_id', opts.beforeId)
    if (opts.tenant) params.set('tenant', opts.tenant)
    const res = await fetch(
      `${base}/api/v1/fleet/channels/${encodeURIComponent(slug)}/messages?${params}`,
      {
        headers: internalHeaders(),
        signal: AbortSignal.timeout(PERSIST_TIMEOUT_MS),
      },
    )
    if (!res.ok) return empty
    const data = (await res.json()) as {
      messages?: FleetChannelMessageRecord[]
      hasMore?: boolean
      nextBefore?: string | null
      nextBeforeId?: string | null
      limit?: number
    }
    const messages = data.messages ?? []
    return {
      messages,
      hasMore: Boolean(data.hasMore),
      nextBefore: data.nextBefore ?? messages[0]?.createdAt ?? null,
      nextBeforeId: data.nextBeforeId ?? messages[0]?.id ?? null,
      limit: data.limit ?? limit,
    }
  } catch {
    return empty
  }
}

/**
 * Convenience: messages only (newest page). Prefer fetchChannelMessagesPage when
 * the caller needs hasMore / cursors.
 */
export async function fetchChannelMessages(
  slug: string,
  limit = 100,
): Promise<FleetChannelMessageRecord[]> {
  const page = await fetchChannelMessagesPage(slug, { limit })
  return page.messages
}

/**
 * Durable upsert of a channel message to Postgres via the control-plane API.
 * Retries with backoff so in-progress and final turns are not lost on blips.
 * Returns true when the API accepted the write.
 */
export async function appendChannelMessage(
  slug: string,
  msg: Omit<FleetChannelMessageRecord, 'createdAt'> & { createdAt?: string },
  tenant?: string | null,
): Promise<boolean> {
  const base = apiBase()
  if (!base) {
    console.warn('[fleet-channel-api] no API_INTERNAL_URL — message not persisted', {
      slug,
      id: msg.id,
    })
    return false
  }

  const url = `${base}${withTenant(`/api/v1/fleet/channels/${encodeURIComponent(slug)}/messages`, tenant)}`
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

/**
 * Persist a gesture through the gesture endpoint so subscribers get
 * `gesture.created` (not a duplicate `message.created` from a full upsert).
 */
export async function persistChannelGesture(
  slug: string,
  messageId: string,
  gesture: { kind: string; userId: string; userName?: string },
  tenant?: string | null,
): Promise<boolean> {
  const base = apiBase()
  if (!base) return false
  const url = `${base}${withTenant(`/api/v1/fleet/channels/${encodeURIComponent(slug)}/messages/${encodeURIComponent(messageId)}/gestures`, tenant)}`
  let lastErr = 'unknown'
  for (let attempt = 1; attempt <= PERSIST_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: internalHeaders(),
        body: JSON.stringify({
          kind: gesture.kind,
          userId: gesture.userId,
          userName: gesture.userName ?? '',
        }),
        signal: AbortSignal.timeout(PERSIST_TIMEOUT_MS),
      })
      if (res.ok) return true
      lastErr = `HTTP ${res.status}`
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        console.error('[fleet-channel-api] gesture persist rejected', {
          slug,
          messageId,
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
  console.error('[fleet-channel-api] gesture persist failed after retries', {
    slug,
    messageId,
    error: lastErr,
  })
  return false
}
