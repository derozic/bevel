/**
 * Server-side AI provider validation + minimal completion probes.
 * Keys are accepted only for the duration of the request — never stored here.
 */

import type { AiProviderId } from '@bevel/schema'
import { OLLAMA_DEFAULT_BASE_URL } from '@bevel/schema'

export type ProviderTestInput = {
  provider: AiProviderId
  apiKey?: string
  /** Custom / Ollama OpenAI-compatible base (no trailing slash preferred) */
  baseUrl?: string
  /** Custom / perplexity / ollama model id */
  modelId?: string
}

export type ProviderTestResult = {
  ok: boolean
  provider: AiProviderId
  message: string
  latencyMs: number
  model?: string
  detail?: string
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '').replace(/\/chat\/completions$/i, '')
}

function isLocalOllamaBase(url: string): boolean {
  try {
    const u = new URL(url.includes('://') ? url : `http://${url}`)
    const host = u.hostname
    const port = u.port || (u.protocol === 'https:' ? '443' : '80')
    const local =
      host === '127.0.0.1' ||
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1'
    return local && (port === '11434' || u.pathname.includes('11434'))
  } catch {
    return /127\.0\.0\.1:11434|localhost:11434/i.test(url)
  }
}

async function timedFetch(
  url: string,
  init: RequestInit,
): Promise<{ res: Response; latencyMs: number }> {
  const t0 = Date.now()
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(60_000),
  })
  return { res, latencyMs: Date.now() - t0 }
}

export async function testAiProvider(
  input: ProviderTestInput,
): Promise<ProviderTestResult> {
  const key = (input.apiKey || '').trim()
  const localOllama =
    input.provider === 'ollama' ||
    (input.provider === 'custom' &&
      isLocalOllamaBase(input.baseUrl || OLLAMA_DEFAULT_BASE_URL))

  // Ollama on Mac needs no real key — OpenAI-compat accepts any bearer
  if (!key && !localOllama) {
    return {
      ok: false,
      provider: input.provider,
      message: 'API key required',
      latencyMs: 0,
    }
  }

  const effectiveKey = key || 'ollama'

  try {
    switch (input.provider) {
      case 'claude':
        return await testClaude(effectiveKey)
      case 'openai':
        return await testOpenAiCompatible({
          provider: 'openai',
          apiKey: effectiveKey,
          baseUrl: 'https://api.openai.com/v1',
          listModels: true,
          modelId: 'gpt-4o-mini',
        })
      case 'gemini':
        return await testGemini(effectiveKey)
      case 'grok':
        return await testOpenAiCompatible({
          provider: 'grok',
          apiKey: effectiveKey,
          baseUrl: 'https://api.x.ai/v1',
          listModels: true,
          modelId: 'grok-2-latest',
        })
      case 'perplexity':
        return await testOpenAiCompatible({
          provider: 'perplexity',
          apiKey: effectiveKey,
          baseUrl: 'https://api.perplexity.ai',
          listModels: false,
          modelId: input.modelId || 'sonar',
          completionOnly: true,
        })
      case 'ollama': {
        const baseUrl = normalizeBaseUrl(
          input.baseUrl || OLLAMA_DEFAULT_BASE_URL,
        )
        const modelId = input.modelId || 'llama3.2:latest'
        return await testOllama({ baseUrl, modelId, apiKey: effectiveKey })
      }
      case 'custom': {
        const baseUrl = normalizeBaseUrl(
          input.baseUrl || 'https://openrouter.ai/api/v1',
        )
        const modelId = input.modelId || 'z-ai/glm-5.2'
        if (isLocalOllamaBase(baseUrl)) {
          return await testOllama({
            baseUrl,
            modelId,
            apiKey: effectiveKey,
          })
        }
        return await testOpenAiCompatible({
          provider: 'custom',
          apiKey: effectiveKey,
          baseUrl,
          listModels: true,
          modelId,
          extraHeaders: baseUrl.includes('openrouter.ai')
            ? {
                'HTTP-Referer':
                  process.env.AUTH_URL ||
                  process.env.NEXTAUTH_URL ||
                  'https://bevel.lvh.me',
                'X-Title': 'BEVEL',
              }
            : undefined,
        })
      }
      default:
        return {
          ok: false,
          provider: input.provider,
          message: 'Unknown provider',
          latencyMs: 0,
        }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Connection failed'
    const hint =
      input.provider === 'ollama' || localOllama
        ? ' Is Ollama running? Try: ollama serve'
        : ''
    return {
      ok: false,
      provider: input.provider,
      message: `${msg}${hint}`,
      latencyMs: 0,
    }
  }
}

async function testOllama(opts: {
  baseUrl: string
  modelId: string
  apiKey: string
}): Promise<ProviderTestResult> {
  const base = normalizeBaseUrl(opts.baseUrl)
  // Prefer native tags for a clear "Ollama is up" signal
  const root = base.replace(/\/v1$/i, '')
  const tagsUrl = `${root}/api/tags`
  try {
    const tags = await timedFetch(tagsUrl, {})
    if (!tags.res.ok) {
      return {
        ok: false,
        provider: 'ollama',
        message: `Ollama not reachable at ${root} (${tags.res.status})`,
        latencyMs: tags.latencyMs,
        detail: 'Start with: ollama serve',
      }
    }
  } catch {
    return {
      ok: false,
      provider: 'ollama',
      message: `Ollama not reachable at ${root}`,
      latencyMs: 0,
      detail: 'Start with: ollama serve  (default port 11434)',
    }
  }

  return await testOpenAiCompatible({
    provider: 'ollama',
    apiKey: opts.apiKey,
    baseUrl: base.endsWith('/v1') ? base : `${base}/v1`,
    listModels: true,
    modelId: opts.modelId,
    completionOnly: false,
  })
}

export async function listOllamaModels(
  baseUrl = OLLAMA_DEFAULT_BASE_URL,
): Promise<{ ok: boolean; models: string[]; baseUrl: string; error?: string }> {
  const base = normalizeBaseUrl(baseUrl)
  const root = base.replace(/\/v1$/i, '')
  try {
    const res = await fetch(`${root}/api/tags`, {
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      return {
        ok: false,
        models: [],
        baseUrl: root,
        error: `Ollama ${res.status}`,
      }
    }
    const data = (await res.json()) as {
      models?: Array<{ name?: string; model?: string }>
    }
    const models = (data.models || [])
      .map((m) => m.name || m.model || '')
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
    return { ok: true, models, baseUrl: root }
  } catch (err) {
    return {
      ok: false,
      models: [],
      baseUrl: root,
      error: err instanceof Error ? err.message : 'unreachable',
    }
  }
}

async function testClaude(apiKey: string): Promise<ProviderTestResult> {
  const { res, latencyMs } = await timedFetch(
    'https://api.anthropic.com/v1/models?limit=1',
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    },
  )
  if (res.ok) {
    return {
      ok: true,
      provider: 'claude',
      message: 'Claude API key valid',
      latencyMs,
      model: 'claude',
    }
  }
  const probe = await timedFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 8,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  })
  if (probe.res.ok) {
    return {
      ok: true,
      provider: 'claude',
      message: 'Claude messages OK',
      latencyMs: probe.latencyMs,
      model: 'claude-3-5-haiku-latest',
    }
  }
  const detail = await safeText(probe.res)
  return {
    ok: false,
    provider: 'claude',
    message: `Claude rejected key (${probe.res.status})`,
    latencyMs: probe.latencyMs,
    detail,
  }
}

async function testGemini(apiKey: string): Promise<ProviderTestResult> {
  const url = new URL(
    'https://generativelanguage.googleapis.com/v1beta/models',
  )
  url.searchParams.set('key', apiKey)
  url.searchParams.set('pageSize', '1')
  const { res, latencyMs } = await timedFetch(url.toString(), {})
  if (res.ok) {
    return {
      ok: true,
      provider: 'gemini',
      message: 'Gemini API key valid',
      latencyMs,
      model: 'gemini',
    }
  }
  return {
    ok: false,
    provider: 'gemini',
    message: `Gemini rejected key (${res.status})`,
    latencyMs,
    detail: await safeText(res),
  }
}

async function testOpenAiCompatible(opts: {
  provider: AiProviderId
  apiKey: string
  baseUrl: string
  modelId: string
  listModels?: boolean
  completionOnly?: boolean
  extraHeaders?: Record<string, string>
}): Promise<ProviderTestResult> {
  const base = normalizeBaseUrl(opts.baseUrl)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.apiKey}`,
    'Content-Type': 'application/json',
    ...opts.extraHeaders,
  }

  if (opts.listModels && !opts.completionOnly) {
    const { res, latencyMs } = await timedFetch(`${base}/models`, { headers })
    if (res.ok) {
      // Still ping completion for Ollama so the chosen tag is real
      if (opts.provider === 'ollama') {
        const ping = await completionProbe(base, headers, opts.modelId)
        if (ping.ok) {
          return {
            ok: true,
            provider: 'ollama',
            message: `Ollama ready · ${opts.modelId}`,
            latencyMs: ping.latencyMs,
            model: opts.modelId,
          }
        }
        return {
          ok: false,
          provider: 'ollama',
          message: ping.message,
          latencyMs: ping.latencyMs,
          model: opts.modelId,
          detail: ping.detail,
        }
      }
      return {
        ok: true,
        provider: opts.provider,
        message: `${opts.provider} models endpoint OK`,
        latencyMs,
        model: opts.modelId,
      }
    }
  }

  return completionProbe(base, headers, opts.modelId, opts.provider)
}

async function completionProbe(
  base: string,
  headers: Record<string, string>,
  modelId: string,
  provider: AiProviderId = 'custom',
): Promise<ProviderTestResult> {
  const { res, latencyMs } = await timedFetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelId,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Reply with the single word: pong' }],
    }),
  })

  if (res.ok) {
    const data = (await res.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>
      model?: string
    } | null
    const snippet = data?.choices?.[0]?.message?.content?.slice(0, 80)
    return {
      ok: true,
      provider,
      message: snippet
        ? `Completion OK — “${snippet.trim()}”`
        : 'Chat completions OK',
      latencyMs,
      model: data?.model || modelId,
    }
  }

  return {
    ok: false,
    provider,
    message: `Provider rejected request (${res.status})`,
    latencyMs,
    detail: await safeText(res),
    model: modelId,
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    const t = await res.text()
    return t.slice(0, 280)
  } catch {
    return ''
  }
}
