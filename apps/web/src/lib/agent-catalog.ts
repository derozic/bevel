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
}

const SEED_AGENTS: Agent[] = [
  {
    id: 'brain',
    name: 'Brain',
    avatar: 'cpu-chip',
    avatarUrl: '/avatars/brain.svg',
    accent: '#7c5cff',
    industry: 'Platform',
    category: 'Orchestration',
    role: 'Fleet coordinator',
    bio: 'Routes work across the agent fleet.',
    skills: ['routing', 'handoffs'],
    directives: [],
    soulMd: '',
    skillMd: '',
    tagline: 'Fleet brain',
  },
  {
    id: 'loom',
    name: 'Loom',
    avatar: 'arrow-path',
    avatarUrl: '/avatars/loom.svg',
    accent: '#a855f7',
    industry: 'Platform',
    category: 'Prompting',
    role: 'Prompt engineer',
    bio: 'Shapes prompts and tool plans.',
    skills: ['prompting', 'tools'],
    directives: [],
    soulMd: '',
    skillMd: '',
    tagline: 'Thread weaver',
  },
  {
    id: 'northstar',
    name: 'Northstar',
    avatar: 'star',
    avatarUrl: '/avatars/northstar.svg',
    accent: '#f59e0b',
    industry: 'Platform',
    category: 'Reliability',
    role: 'SRE partner',
    bio: 'Watches signals and suggests fixes.',
    skills: ['monitoring', 'incidents'],
    directives: [],
    soulMd: '',
    skillMd: '',
    tagline: 'Signal scout',
  },
  {
    id: 'lego',
    name: 'Lego',
    avatar: 'wrench-screwdriver',
    avatarUrl: '/avatars/lego.svg',
    accent: '#22c55e',
    industry: 'Engineering',
    category: 'Testing',
    role: 'Test builder',
    bio: 'Builds and runs test harnesses.',
    skills: ['vitest', 'playwright'],
    directives: [],
    soulMd: '',
    skillMd: '',
    tagline: 'Test stack',
  },
  {
    id: 'tegan',
    name: 'Tegan',
    avatar: 'building-office-2',
    avatarUrl: '/avatars/tegan.svg',
    accent: '#ec4899',
    industry: 'Design',
    category: 'UI',
    role: 'Design systems',
    bio: 'Tokens, layout, accessibility.',
    skills: ['tokens', 'a11y'],
    directives: [],
    soulMd: '',
    skillMd: '',
    tagline: 'Surface craft',
  },
  {
    id: 'johnny',
    name: 'Johnny',
    avatar: 'wrench-screwdriver',
    avatarUrl: '/avatars/johnny.svg',
    accent: '#38bdf8',
    industry: 'Ops',
    category: 'Patrol',
    role: 'Platform patrol',
    bio: 'Heals infra and keeps lanes green.',
    skills: ['patrol', 'caddy'],
    directives: [],
    soulMd: '',
    skillMd: '',
    tagline: 'Night shift',
  },
]

export const agents = SEED_AGENTS

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