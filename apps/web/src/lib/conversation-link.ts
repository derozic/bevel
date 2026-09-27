import { bevelApiFetch } from '@/lib/bevel-api.server'

export type ConversationLinkPreview = {
  status: 'active' | 'expired' | 'revoked' | 'missing' | 'unavailable'
  title: string
  agentIds: string[]
  expiresAt: string | null
  pinRequired: boolean
  pinLength: 4 | 6 | 8 | null
  allowOutside: boolean
  verify: 'single' | 'double'
}

export async function previewConversationLink(token: string): Promise<ConversationLinkPreview> {
  try {
    const res = await bevelApiFetch(`/api/v1/conversation-links/${encodeURIComponent(token)}`, {
      auth: false,
      cache: 'no-store',
    })
    if (!res.ok) {
      return emptyPreview('unavailable')
    }
    const data = (await res.json()) as ConversationLinkPreview
    const length = data.pinLength
    return {
      status: data.status || 'missing',
      title: data.title || '',
      agentIds: Array.isArray(data.agentIds) ? data.agentIds : [],
      expiresAt: data.expiresAt ?? null,
      pinRequired: Boolean(data.pinRequired),
      pinLength: length === 4 || length === 6 || length === 8 ? length : null,
      allowOutside: data.allowOutside !== false,
      verify: data.verify === 'double' ? 'double' : 'single',
    }
  } catch {
    return emptyPreview('unavailable')
  }
}

function emptyPreview(status: ConversationLinkPreview['status']): ConversationLinkPreview {
  return {
    status,
    title: '',
    agentIds: [],
    expiresAt: null,
    pinRequired: false,
    pinLength: null,
    allowOutside: true,
    verify: 'single',
  }
}

export async function redeemConversationLink(token: string): Promise<string | null> {
  const res = await bevelApiFetch(
    `/api/v1/conversation-links/${encodeURIComponent(token)}/redeem`,
    { method: 'POST' },
  )
  if (!res.ok) return null
  const data = (await res.json()) as { href?: string }
  return data.href && data.href.startsWith('/') ? data.href : null
}
