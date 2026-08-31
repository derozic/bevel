import { resolvePlatformAgentId } from '@bevel/schema/platform-agents'
import { loadMergedRegistry } from './registry-merge.js'
import { AgentPresence } from './schema/ChatState.js'

type NamedAgent = { id: string; name: string }

type RosterState = {
  agentIds: { includes(id: string): boolean; push(id: string): number }
  agents: {
    push(row: AgentPresence): number
  }
}

export function canonicalizeAgentId(token: string): string {
  const raw = token.trim().toLowerCase()
  return resolvePlatformAgentId(raw) ?? raw
}

/** All @tokens in text, aliases folded to canonical ids (chatgpt → openai). */
export function mentionedCanonicalIds(
  text: string,
  agents: NamedAgent[],
): string[] {
  const byId = new Map(agents.map((a) => [a.id.toLowerCase(), a.id]))
  const byName = new Map(agents.map((a) => [a.name.toLowerCase(), a.id]))
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of text.matchAll(/@([a-z0-9_-]+)\b/gi)) {
    const raw = m[1]!.toLowerCase()
    const id = byId.get(raw) || byName.get(raw) || resolvePlatformAgentId(raw)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function resolveDispatchTargets(opts: {
  text: string
  explicit?: string
  agentIds: string[]
  agents: NamedAgent[]
}): string[] {
  const inSession = (id: string) => opts.agentIds.includes(id)
  if (opts.explicit) {
    const id = canonicalizeAgentId(opts.explicit)
    return inSession(id) ? [id] : []
  }
  const mentioned = mentionedCanonicalIds(opts.text, opts.agents)
  const hits = mentioned.filter(inSession)
  if (hits.length) return hits
  if (opts.agentIds.length === 1) return [opts.agentIds[0]!]
  const lower = opts.text.toLowerCase()
  for (const agent of opts.agents) {
    if (
      lower.includes(`@${agent.id}`) ||
      lower.includes(agent.name.toLowerCase())
    ) {
      return [agent.id]
    }
  }
  return [...opts.agentIds]
}

/** Seat catalog agents that the client just added or @mentioned. */
export function ensureAgentsInRoster(
  state: RosterState,
  ids: string[],
): string[] {
  const catalog = loadMergedRegistry()
  const added: string[] = []
  for (const raw of ids) {
    const id = canonicalizeAgentId(raw)
    if (!id || state.agentIds.includes(id)) continue
    const meta = catalog.find((a) => a.id === id)
    if (!meta) continue
    state.agentIds.push(id)
    const row = new AgentPresence()
    row.id = id
    row.name = meta.name
    row.accent = meta.accent ?? '#1a1410'
    row.source = meta.federated ? 'federated' : 'fleet'
    state.agents.push(row)
    added.push(id)
  }
  return added
}
