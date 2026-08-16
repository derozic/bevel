/**
 * Web fleet catalog — derived from the synced ~/dev/agents registry.
 * Refresh with `pnpm sync:agents`.
 */
import fleetRegistry from './fleet-registry.json'

export type AgentAvatarIcon =
  | 'building-office-2'
  | 'cpu-chip'
  | 'arrow-path'
  | 'wrench-screwdriver'
  | 'star'

export interface Agent {
  id: string
  name: string
  avatar: AgentAvatarIcon
  avatarUrl?: string
  accent?: string
  industry: string
  category: string
  role: string
  bio: string
  skills: string[]
  directives: string[]
  soulMd: string
  skillMd: string
  tagline?: string
  summary?: string
  tier?: string
  reportsTo?: string
}

type RegistryAgent = {
  id: string
  name: string
  tier?: string
  category?: string
  role?: string
  description?: string
  avatar?: string
  accent?: string
  reportsTo?: string
  skills?: string[]
  soul?: string
  recursiveSkills?: string[]
  run?: { hint?: string }
}

function iconFor(agent: RegistryAgent): AgentAvatarIcon {
  const category = (agent.category ?? '').toLowerCase()
  const tier = (agent.tier ?? '').toLowerCase()
  if (tier === 'co-founder' || category.includes('leadership')) return 'cpu-chip'
  if (category.includes('design')) return 'building-office-2'
  if (
    category.includes('evaluat') ||
    category.includes('monitor') ||
    category.includes('product') ||
    category.includes('research')
  ) {
    return 'star'
  }
  if (
    category.includes('continuous') ||
    category.includes('operation') ||
    category.includes('admin')
  ) {
    return 'arrow-path'
  }
  if (
    category.includes('engineer') ||
    category.includes('develop') ||
    category.includes('test') ||
    category.includes('qa') ||
    category.includes('platform')
  ) {
    return 'wrench-screwdriver'
  }
  return 'cpu-chip'
}

/** Prefer the synced SVG portrait; fall back to the registry path. */
function avatarUrlFor(agent: RegistryAgent): string {
  if (agent.id) return `/avatars/${agent.id}.svg`
  const raw = agent.avatar?.trim()
  return raw && raw.startsWith('/') ? raw : '/avatars/hermes.svg'
}

function taglineFor(agent: RegistryAgent): string {
  const soul = (agent.soul ?? '').trim()
  if (soul) {
    const head = soul.split(/\s[—–-]\s/)[0]?.trim()
    if (head && head.length <= 56) return head
  }
  const hint = agent.run?.hint?.split('.')[0]?.trim()
  if (hint) return hint
  return agent.role || agent.name
}

function mapRegistryAgent(agent: RegistryAgent): Agent {
  const category = agent.category || 'Fleet'
  return {
    id: agent.id,
    name: agent.name,
    avatar: iconFor(agent),
    avatarUrl: avatarUrlFor(agent),
    accent: agent.accent,
    industry: category,
    category,
    role: agent.role || agent.name,
    bio: agent.description || agent.soul || '',
    skills: agent.skills ?? [],
    directives: [],
    soulMd: agent.soul ?? '',
    skillMd: (agent.recursiveSkills ?? []).join('\n'),
    tagline: taglineFor(agent),
    summary: agent.description || agent.soul,
    tier: agent.tier,
    reportsTo: agent.reportsTo,
  }
}

const SEED_AGENTS: Agent[] = (fleetRegistry.agents as RegistryAgent[]).map(
  mapRegistryAgent,
)

export const agents = SEED_AGENTS

export const fleetRegistryMeta = {
  version: (fleetRegistry as { version?: string }).version ?? '0',
  lastUpdated: (fleetRegistry as { lastUpdated?: string }).lastUpdated ?? '',
  source: 'dev/agents',
}

export function getAgentById(id: string): Agent | undefined {
  return agents.find((a) => a.id.toLowerCase() === id.toLowerCase())
}

export function getAvailableAgents(): Agent[] {
  return agents
}

export function getAgentsByCategory(category: string): Agent[] {
  return agents.filter((a) => a.category === category)
}

export function getCatalogCategories(): string[] {
  return [...new Set(agents.map((a) => a.category))]
}

export function getCatalogIndustries(): string[] {
  return [...new Set(agents.map((a) => a.industry))]
}

export function getFleetStats() {
  return { total: agents.length, categories: getCatalogCategories().length }
}
