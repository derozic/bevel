import { agents } from '@/lib/agent-catalog'

const DEFAULT_CHAT_AGENTS = ['brain', 'johnny', 'loom', 'northstar'] as const

const catalogIds = new Set(agents.map((a) => a.id.toLowerCase()))

/** Parse `?agents=hermes,johnny` into validated catalog ids. */
export function parseChatAgentsParam(param: string | undefined): string[] | null {
  if (!param?.trim()) return null

  const ids = param
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter((id) => catalogIds.has(id))

  return ids.length ? [...new Set(ids)] : null
}

export function defaultChatAgents(): string[] {
  return [...DEFAULT_CHAT_AGENTS]
}

export function resolveChatAgents(param: string | undefined): string[] {
  return parseChatAgentsParam(param) ?? defaultChatAgents()
}