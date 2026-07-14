/**
 * ^product channel — GitHub issues, agent work moves, releases, CI.
 * Posts into fleet message store + live Colyseus inject (best-effort).
 */

import {
  formatAgentActivityMessage,
  PRODUCT_CHANNEL_SLUG,
  type AgentActivityKind,
} from '@/lib/github'

function apiBase(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.FLEET_CHANNEL_API_URL ||
    'http://127.0.0.1:43203'
  )
}

function realtimeBase(): string {
  return (
    process.env.REALTIME_INTERNAL_URL ||
    process.env.AGENTS_REALTIME_URL ||
    'http://127.0.0.1:43208'
  )
}

function fleetHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const key = process.env.FLEET_INTERNAL_API_KEY
  if (key) headers['X-Fleet-Internal-Key'] = key
  return headers
}

export async function postProductChannelMessage(input: {
  kind: AgentActivityKind
  agentId?: string
  agentName?: string
  title: string
  body?: string
  repo?: string
  url?: string
  issueNumber?: number
  channelSlug?: string
}): Promise<{ ok: boolean; messageId: string; persisted: boolean; liveInjected: number }> {
  const channelSlug = (input.channelSlug || PRODUCT_CHANNEL_SLUG).toLowerCase()
  const agentId = (input.agentId || 'system').toLowerCase()
  const speakerName = (input.agentName || agentId).toUpperCase()
  const text = formatAgentActivityMessage(input)
  const msgId = `gh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const headers = fleetHeaders()

  let persisted = false
  try {
    const res = await fetch(
      `${apiBase()}/api/v1/fleet/channels/${encodeURIComponent(channelSlug)}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: msgId,
          speakerId: agentId === 'system' ? 'system:github' : `agent:${agentId}`,
          speakerName: agentId === 'system' ? 'GitHub' : speakerName,
          speakerType: agentId === 'system' ? 'system' : 'agent',
          agentId: agentId === 'system' ? undefined : agentId,
          body: text,
          status: 'final',
          tags: ['github', 'product', input.kind, agentId],
        }),
      },
    )
    persisted = res.ok
  } catch {
    persisted = false
  }

  let liveInjected = 0
  try {
    const res = await fetch(`${realtimeBase()}/api/program-events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: msgId,
        agentId: agentId === 'system' ? 'johnny' : agentId,
        speakerName: agentId === 'system' ? 'GitHub' : speakerName,
        body: text,
        channelSlug,
        tags: ['github', 'product', input.kind],
        persist: !persisted,
      }),
    })
    if (res.ok) {
      const data = (await res.json()) as { injected?: unknown[] }
      liveInjected = Array.isArray(data.injected) ? data.injected.length : 0
    }
  } catch {
    liveInjected = 0
  }

  return { ok: persisted || liveInjected > 0, messageId: msgId, persisted, liveInjected }
}
