import {
  BEVEL_COPY,
  BEVEL_WORD,
  BEVEL_TM,
  BEVEL_NAME,
  BEVEL_POWERED_BY_LABEL,
  BEVEL_TRADEMARK_NOTICE,
  BEVEL_PRODUCT,
  CHANNEL_TAG_PREFIX,
  channelTag,
  type BevelProduct,
} from '@bevel/realtime-client'

export {
  BEVEL_COPY,
  BEVEL_WORD,
  BEVEL_TM,
  BEVEL_NAME,
  BEVEL_POWERED_BY_LABEL,
  BEVEL_TRADEMARK_NOTICE,
  BEVEL_PRODUCT,
  CHANNEL_TAG_PREFIX,
  channelTag,
  type BevelProduct,
}

export const BEVEL_TAGLINE = BEVEL_PRODUCT.tagline
export const BEVEL_SHORT = BEVEL_PRODUCT.short

/** Workspace home → default channel (public URL uses hash fragment). */
export const BEVEL_HOME_PATH = '/#general'
export const BEVEL_DEFAULT_CHANNEL = 'general'
export const BEVEL_ARCHIVE_PATH = '/sessions'
/** Direct agent threads: /talk/brain */
export const BEVEL_TALK_PATH = '/talk'
export const BEVEL_SESSION_PATH = '/session'

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

/**
 * Canonical channel URL: `/#general` (hash fragment — never percent-encoded).
 *
 * Note: the fragment is not sent to the HTTP server. Org hosts serve the
 * workspace shell at `/` and the client reads `location.hash` for the slug.
 * Internal Next routes under /bevel/* still exist for talk/session and as a
 * server fallback (middleware redirects channel paths to the hash form).
 */
export function bevelChannelPath(slug: string): string {
  const normalized = normalizeBevelChannelSlug(slug)
  return `/#${normalized}`
}

/** Legacy /bevel/c/:slug — still accepted via redirects. */
export function bevelLegacyChannelPath(slug: string): string {
  return `/bevel/c/${slug.trim().toLowerCase()}`
}

export function chatLegacyChannelPath(slug: string): string {
  return `/chat/c/${slug.trim().toLowerCase()}`
}

export function normalizeBevelChannelSlug(slug: string): string {
  const normalized = slug
    .trim()
    .toLowerCase()
    .replace(/^%5e/i, '')
    .replace(/^%23/i, '')
    .replace(/^[#^]+/, '')
  if (!SLUG_RE.test(normalized)) {
    return BEVEL_DEFAULT_CHANNEL
  }
  return normalized
}

/**
 * Channel link with optional agents query.
 * Query must precede the fragment: `/?agents=brain#general`
 */
export function bevelChannelHref(slug: string, agents?: string): string {
  const hash = `#${normalizeBevelChannelSlug(slug)}`
  if (!agents?.trim()) return `/${hash}`
  return `/?agents=${encodeURIComponent(agents)}${hash}`
}

/**
 * Browser / tab title for workspace surfaces.
 * Prefer the org brand (e.g. "2x4m") over generic BEVEL when known.
 */
export function bevelPageTitle(
  channelSlug?: string,
  workspaceLabel?: string | null,
): string {
  const brand = (workspaceLabel || '').trim() || BEVEL_NAME
  const clean = brand.replace(/\s+Agents$/i, '').trim() || brand
  if (channelSlug) return `${clean} · #${channelSlug}`
  return clean
}

export function bevelTalkPath(agentId: string, agents?: string): string {
  const id = agentId.trim().toLowerCase()
  const base = `${BEVEL_TALK_PATH}/${encodeURIComponent(id)}`
  if (!agents?.trim()) return base
  return `${base}?agents=${encodeURIComponent(agents)}`
}

export function bevelSessionPath(sessionId: string): string {
  return `${BEVEL_SESSION_PATH}/${encodeURIComponent(sessionId)}`
}

/** Prefer canonical agent chat URL for single-agent direct threads. */
export function bevelConversationPath(summary: {
  sessionId: string
  agentIds: string[]
}): string {
  if (summary.agentIds.length === 1) {
    return bevelTalkPath(summary.agentIds[0]!)
  }
  return bevelSessionPath(summary.sessionId)
}

/** Stable session id so a user resumes the same thread with the same agent roster. */
export function bevelDirectSessionId(userId: string, agentIds: string[]): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const roster = [...new Set(agentIds.map((id) => id.trim().toLowerCase()))]
    .sort()
    .join('+')
  return `dm-${safeUser}-${roster}`
}

export function bevelConversationTitle(agentNames: string[]): string {
  if (agentNames.length === 0) return BEVEL_NAME
  if (agentNames.length === 1) return agentNames[0]!
  if (agentNames.length === 2) return `${agentNames[0]} & ${agentNames[1]}`
  return `${agentNames[0]} +${agentNames.length - 1}`
}

/**
 * Deep-link into a message with highlight query.
 * Query string before hash: `/?msg=…&q=…#general`
 */
export function bevelMessageHref(opts: {
  kind: 'channel' | 'session'
  channelSlug?: string
  sessionId?: string
  messageId: string
  query?: string
}): string {
  const params = new URLSearchParams()
  params.set('msg', opts.messageId)
  if (opts.query?.trim()) params.set('q', opts.query.trim())
  const qs = params.toString()

  if (opts.kind === 'channel') {
    const slug = normalizeBevelChannelSlug(
      opts.channelSlug || opts.sessionId || BEVEL_DEFAULT_CHANNEL,
    )
    return qs ? `/?${qs}#${slug}` : `/#${slug}`
  }
  const base = bevelSessionPath(opts.sessionId || 'unknown')
  return qs ? `${base}?${qs}` : base
}
