import {
  BEVEL_COPY,
  BEVEL_WORD,
  BEVEL_TM,
  BEVEL_NAME,
  BEVEL_POWERED_BY_LABEL,
  BEVEL_TRADEMARK_NOTICE,
  BEVEL_PRODUCT,
  CHANNEL_TAG_PREFIX,
  CHANNEL_ESCALATED_PREFIX,
  channelTag,
  isEscalatedChannelTag,
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
  CHANNEL_ESCALATED_PREFIX,
  channelTag,
  isEscalatedChannelTag,
  type BevelProduct,
}

/** Sort rail channels: escalated first (A–Z), then normal (A–Z). */
export function sortChannelsByEscalation<T extends { slug: string }>(
  channels: T[],
  escalatedSlugs: readonly string[],
): T[] {
  const escalated = new Set(
    escalatedSlugs.map((s) => s.trim().toLowerCase()).filter(Boolean),
  )
  return [...channels].sort((a, b) => {
    const aEsc = escalated.has(a.slug.toLowerCase())
    const bEsc = escalated.has(b.slug.toLowerCase())
    if (aEsc !== bEsc) return aEsc ? -1 : 1
    return a.slug.localeCompare(b.slug, undefined, { sensitivity: 'base' })
  })
}

export const BEVEL_TAGLINE = BEVEL_PRODUCT.tagline
export const BEVEL_SHORT = BEVEL_PRODUCT.short

/** Workspace home → default channel (public path; tilde is unreserved in URLs). */
export const BEVEL_HOME_PATH = '/~general'
export const BEVEL_DEFAULT_CHANNEL = 'general'
export const BEVEL_ARCHIVE_PATH = '/sessions'
/** Direct agent threads: /talk/brain */
export const BEVEL_TALK_PATH = '/talk'
export const BEVEL_SESSION_PATH = '/session'
/** Personal reverse-chrono feed for @mentions and ^escalations */
export const BEVEL_TIMELINE_PATH = '/timeline'

/** User lookup / connection card for @handle and ^handle */
export function bevelUserPath(handle: string): string {
  const h = handle.trim().toLowerCase().replace(/^[@^~#]+/, '')
  return `/u/${encodeURIComponent(h || 'unknown')}`
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

/**
 * Canonical channel URL: `/~general` (tilde is RFC unreserved — never encoded).
 * Rewritten by next.config to internal `/bevel/general`.
 */
export function bevelChannelPath(slug: string): string {
  const normalized = normalizeBevelChannelSlug(slug)
  return `/~${normalized}`
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
    .replace(/^%7e/i, '')
    .replace(/^[#^~]+/, '')
  if (!SLUG_RE.test(normalized)) {
    return BEVEL_DEFAULT_CHANNEL
  }
  return normalized
}

/**
 * Channel link with optional agents query: `/~general?agents=brain`
 */
export function bevelChannelHref(slug: string, agents?: string): string {
  const base = bevelChannelPath(slug)
  if (!agents?.trim()) return base
  return `${base}?agents=${encodeURIComponent(agents)}`
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
  if (channelSlug) return `${clean} · ~${channelSlug}`
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
 * `/~general?msg=…&q=…`
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
    return qs ? `/~${slug}?${qs}` : `/~${slug}`
  }
  const base = bevelSessionPath(opts.sessionId || 'unknown')
  return qs ? `${base}?${qs}` : base
}
