import {
  PLATFORM_AGENTS,
  isPlatformAgentId,
  resolvePlatformAgentId,
  type PlatformAgentId,
} from './platform-agents.js'

type ChatTurn = { role: string; content: string }

export type PlatformChatResult = {
  output: string
  model: string
  confidence: number
}

const DEFAULT_MODELS: Record<PlatformAgentId, string> = {
  openai: process.env.OPENAI_MODEL?.trim() || 'gpt-4o',
  claude: process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514',
  grok: process.env.GROK_MODEL?.trim() || 'grok-3',
}

const OPENROUTER_MODELS: Record<PlatformAgentId, string> = {
  openai: process.env.OPENAI_OPENROUTER_MODEL?.trim() || 'openai/gpt-4o',
  claude: process.env.ANTHROPIC_OPENROUTER_MODEL?.trim() || 'anthropic/claude-sonnet-4',
  grok: process.env.GROK_OPENROUTER_MODEL?.trim() || 'x-ai/grok-4.3',
}

function keyFor(id: PlatformAgentId): string {
  if (id === 'openai') return (process.env.OPENAI_API_KEY || '').trim()
  if (id === 'claude') return (process.env.ANTHROPIC_API_KEY || '').trim()
  return (process.env.GROK_API_KEY || process.env.XAI_API_KEY || '').trim()
}

function openRouterKey(): string {
  return (process.env.OPENROUTER_API_KEY || '').trim()
}

function keyHint(id: PlatformAgentId): string {
  if (id === 'openai') return 'OPENAI_API_KEY'
  if (id === 'claude') return 'ANTHROPIC_API_KEY'
  return 'GROK_API_KEY or XAI_API_KEY'
}

function systemPrompt(id: PlatformAgentId): string {
  const agent = PLATFORM_AGENTS.find((a) => a.id === id)!
  return [
    `You are ${agent.name} (@${id}), a first-class agent in a BEVEL channel.`,
    agent.description,
    'You are in a multi-party room with humans and other agents (Hermes, Claude, ChatGPT, Grok).',
    'Stay in character for your platform. Be concrete. No emoji in code or formal artifacts.',
    'If another agent is in the thread, build on them — do not pretend to be them.',
  ].join(' ')
}

function openAiMessages(id: PlatformAgentId, message: string, history: ChatTurn[]) {
  const prior = history
    .filter((h) => h.role === 'user' || h.role === 'assistant')
    .map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }))
  return [
    { role: 'system' as const, content: systemPrompt(id) },
    ...prior,
    { role: 'user' as const, content: message },
  ]
}

function claudeMessages(message: string, history: ChatTurn[]) {
  const prior = history
    .filter((h) => h.role === 'user' || h.role === 'assistant')
    .map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }))
  const messages: { role: 'user' | 'assistant'; content: string }[] = [...prior]
  if (messages.length === 0 || messages[messages.length - 1]?.role !== 'user') {
    messages.push({ role: 'user', content: message })
  } else {
    messages[messages.length - 1] = { role: 'user', content: message }
  }
  if (messages[0]?.role === 'assistant') {
    messages.unshift({ role: 'user', content: '(channel open)' })
  }
  return messages
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, json }
}

function openAiText(json: Record<string, unknown>): string {
  const choices = json.choices as Array<{ message?: { content?: string } }> | undefined
  return (choices?.[0]?.message?.content || '').trim()
}

function claudeText(json: Record<string, unknown>): string {
  const blocks = json.content as Array<{ type?: string; text?: string }> | undefined
  return (blocks || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text || '')
    .join('')
    .trim()
}

export function isPlatformAgent(agentId: string): boolean {
  return Boolean(resolvePlatformAgentId(agentId))
}

async function dispatchViaOpenRouter(
  id: PlatformAgentId,
  name: string,
  message: string,
  history: ChatTurn[],
  key: string,
): Promise<PlatformChatResult> {
  const model = OPENROUTER_MODELS[id]
  const { status, json } = await postJson(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      authorization: `Bearer ${key}`,
      'http-referer': 'https://bevel.is',
      'x-title': 'BEVEL',
    },
    {
      model,
      temperature: 0.7,
      messages: openAiMessages(id, message, history),
    },
  )
  if (status !== 200) {
    const err = json.error as { message?: string } | undefined
    throw new Error(err?.message || `${name} OpenRouter request failed: ${status}`)
  }
  return { output: openAiText(json) || '…', model, confidence: 0.7 }
}

export async function dispatchPlatformAgentChat(
  agentId: string,
  message: string,
  history: ChatTurn[] = [],
): Promise<PlatformChatResult> {
  const id = resolvePlatformAgentId(agentId)
  if (!id || !isPlatformAgentId(id)) {
    throw new Error(`Not a platform agent: ${agentId}`)
  }
  const key = keyFor(id)
  const name = PLATFORM_AGENTS.find((a) => a.id === id)?.name ?? id
  const routerKey = openRouterKey()
  if (!key && routerKey) {
    return dispatchViaOpenRouter(id, name, message, history, routerKey)
  }
  if (!key) {
    return {
      output: `${name} is not configured on this host. Set ${keyHint(id)} on the realtime process.`,
      model: DEFAULT_MODELS[id],
      confidence: 0,
    }
  }

  try {
    return await dispatchNative(id, name, message, history, key)
  } catch (err) {
    if (routerKey) {
      return dispatchViaOpenRouter(id, name, message, history, routerKey)
    }
    throw err
  }
}

async function dispatchNative(
  id: PlatformAgentId,
  name: string,
  message: string,
  history: ChatTurn[],
  key: string,
): Promise<PlatformChatResult> {
  const model = DEFAULT_MODELS[id]
  if (id === 'claude') {
    const { status, json } = await postJson(
      'https://api.anthropic.com/v1/messages',
      {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      {
        model,
        max_tokens: 4096,
        temperature: 0.7,
        system: systemPrompt(id),
        messages: claudeMessages(message, history),
      },
    )
    if (status !== 200) {
      const err = json.error as { message?: string } | undefined
      throw new Error(err?.message || `Claude request failed: ${status}`)
    }
    return { output: claudeText(json) || '…', model, confidence: 0.7 }
  }

  const url =
    id === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.x.ai/v1/chat/completions'
  const { status, json } = await postJson(
    url,
    { authorization: `Bearer ${key}` },
    {
      model,
      temperature: 0.7,
      messages: openAiMessages(id, message, history),
    },
  )
  if (status !== 200) {
    const err = json.error as { message?: string } | undefined
    throw new Error(err?.message || `${name} request failed: ${status}`)
  }
  return { output: openAiText(json) || '…', model, confidence: 0.7 }
}
