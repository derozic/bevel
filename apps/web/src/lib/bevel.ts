import {
  BEVEL_COPY,
  BEVEL_NAME,
  BEVEL_POWERED_BY_LABEL,
  BEVEL_PRODUCT,
  type BevelProduct,
} from '@bevel/realtime-client'

export {
  BEVEL_COPY,
  BEVEL_NAME,
  BEVEL_POWERED_BY_LABEL,
  BEVEL_PRODUCT,
  type BevelProduct,
}

export const BEVEL_TAGLINE = BEVEL_PRODUCT.tagline
export const BEVEL_SHORT = BEVEL_PRODUCT.short

export const BEVEL_HOME_PATH = '/bevel'
export const BEVEL_DEFAULT_CHANNEL = 'general'
export const BEVEL_ARCHIVE_PATH = '/sessions'
export const BEVEL_TALK_PATH = '/bevel/talk'
export const BEVEL_SESSION_PATH = '/bevel/session'

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

/** Canonical channel URL: /bevel/general (no /c/ — that was legacy Slack mimicry). */
export function bevelChannelPath(slug: string): string {
  const normalized = slug.trim().toLowerCase()
  return `/bevel/${normalized}`
}

/** Legacy /bevel/c/:slug and /chat/c/:slug — still accepted via redirects. */
export function bevelLegacyChannelPath(slug: string): string {
  return `/bevel/c/${slug.trim().toLowerCase()}`
}

export function chatLegacyChannelPath(slug: string): string {
  return `/chat/c/${slug.trim().toLowerCase()}`
}

export function normalizeBevelChannelSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase()
  if (!SLUG_RE.test(normalized)) {
    return BEVEL_DEFAULT_CHANNEL
  }
  return normalized
}

export function bevelChannelHref(slug: string, agents?: string): string {
  const base = bevelChannelPath(slug)
  if (!agents?.trim()) return base
  return `${base}?agents=${encodeURIComponent(agents)}`
}

export function bevelPageTitle(channelSlug?: string): string {
  if (channelSlug) return `${BEVEL_NAME} · #${channelSlug} · 2x4m Agents`
  return `${BEVEL_NAME} · 2x4m Agents`
}

export function bevelTalkPath(agentId: string, agents?: string): string {
  const id = agentId.trim().toLowerCase()
  const base = `/${encodeURIComponent(id)}/chat`
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
  const roster = [...new Set(agentIds.map((id) => id.trim().toLowerCase()))].sort().join('+')
  return `dm-${safeUser}-${roster}`
}

export function bevelConversationTitle(agentNames: string[]): string {
  if (agentNames.length === 0) return BEVEL_NAME
  if (agentNames.length === 1) return agentNames[0]!
  if (agentNames.length === 2) return `${agentNames[0]} & ${agentNames[1]}`
  return `${agentNames[0]} +${agentNames.length - 1}`
}