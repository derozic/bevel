/** First-class platform models that sit in Bevel like Hermes.
 *  Keep in sync with packages/schema/src/platform-agents.ts (web catalog).
 *  Realtime compiles this to dist/ so Node can load it without TypeScript.
 */

export const PLATFORM_AGENT_IDS = ['openai', 'claude', 'grok'] as const
export type PlatformAgentId = (typeof PLATFORM_AGENT_IDS)[number]

/** Extra @tokens that resolve to a platform agent id. */
export const PLATFORM_AGENT_ALIASES: Record<string, PlatformAgentId> = {
  chatgpt: 'openai',
  openai: 'openai',
  anthropic: 'claude',
  claude: 'claude',
  grok: 'grok',
  xai: 'grok',
}

export type PlatformAgentRecord = {
  id: PlatformAgentId
  name: string
  accent: string
  avatar: string
  category: string
  role: string
  description: string
  tagline: string
  skills: string[]
  aliases: string[]
}

export const PLATFORM_AGENTS: PlatformAgentRecord[] = [
  {
    id: 'openai',
    name: 'ChatGPT',
    accent: '#101010',
    avatar: '/avatars/openai.svg',
    category: 'Platform',
    role: 'OpenAI',
    description:
      'OpenAI ChatGPT in the room — same seat as Hermes. Fast structured answers, coding, and tool-shaped output.',
    tagline: 'OpenAI in the room',
    skills: ['ChatGPT', 'Structured output', 'Coding', 'Tool planning'],
    aliases: ['chatgpt', 'openai'],
  },
  {
    id: 'claude',
    name: 'Claude',
    accent: '#D97757',
    avatar: '/avatars/claude.svg',
    category: 'Platform',
    role: 'Anthropic',
    description:
      'Anthropic Claude in the room — long-context reasoning and careful written work alongside the fleet.',
    tagline: 'Anthropic in the room',
    skills: ['Claude', 'Long context', 'Reasoning', 'Writing'],
    aliases: ['claude', 'anthropic'],
  },
  {
    id: 'grok',
    name: 'Grok',
    accent: '#111111',
    avatar: '/avatars/grok.svg',
    category: 'Platform',
    role: 'xAI',
    description:
      'xAI Grok in the room — direct, current, and available in mixed channels with Hermes and Claude.',
    tagline: 'xAI in the room',
    skills: ['Grok', 'xAI', 'Realtime takes', 'Search-flavored answers'],
    aliases: ['grok', 'xai'],
  },
]

export function isPlatformAgentId(id: string): id is PlatformAgentId {
  return (PLATFORM_AGENT_IDS as readonly string[]).includes(id.toLowerCase())
}

export function resolvePlatformAgentId(token: string): PlatformAgentId | undefined {
  const raw = token.trim().toLowerCase()
  return PLATFORM_AGENT_ALIASES[raw]
}
