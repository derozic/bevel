import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dispatchPlatformAgentChat,
  isPlatformAgent,
} from './platform-providers'

const saved = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GROK_API_KEY: process.env.GROK_API_KEY,
  XAI_API_KEY: process.env.XAI_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
}

afterEach(() => {
  process.env.OPENAI_API_KEY = saved.OPENAI_API_KEY
  process.env.ANTHROPIC_API_KEY = saved.ANTHROPIC_API_KEY
  process.env.GROK_API_KEY = saved.GROK_API_KEY
  process.env.XAI_API_KEY = saved.XAI_API_KEY
  process.env.OPENROUTER_API_KEY = saved.OPENROUTER_API_KEY
  vi.unstubAllGlobals()
})

describe('platform providers', () => {
  it('treats ChatGPT / Anthropic / xAI aliases as platform seats', () => {
    expect(isPlatformAgent('chatgpt')).toBe(true)
    expect(isPlatformAgent('openai')).toBe(true)
    expect(isPlatformAgent('anthropic')).toBe(true)
    expect(isPlatformAgent('claude')).toBe(true)
    expect(isPlatformAgent('xai')).toBe(true)
    expect(isPlatformAgent('grok')).toBe(true)
    expect(isPlatformAgent('hermes')).toBe(false)
  })

  it('returns a configured-host message when the key is missing', async () => {
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENROUTER_API_KEY
    const res = await dispatchPlatformAgentChat('chatgpt', 'hello')
    expect(res.confidence).toBe(0)
    expect(res.output).toMatch(/OPENAI_API_KEY/)
    expect(res.output).toMatch(/ChatGPT/)
  })

  it('falls back to OpenRouter when the native key is missing', async () => {
    delete process.env.GROK_API_KEY
    delete process.env.XAI_API_KEY
    process.env.OPENROUTER_API_KEY = 'sk-or-test'
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'from grok via openrouter' } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await dispatchPlatformAgentChat('grok', 'hi', [])
    expect(res.output).toBe('from grok via openrouter')
    expect(res.model).toBe('x-ai/grok-4.3')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(init.headers).toMatchObject({
      authorization: 'Bearer sk-or-test',
    })
  })

  it('falls back to OpenRouter when the native provider is out of credits', async () => {
    process.env.OPENAI_API_KEY = 'sk-dead'
    process.env.OPENROUTER_API_KEY = 'sk-or-test'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: 429,
        json: async () => ({
          error: { message: 'You have no credits remaining.' },
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'from openrouter after native fail' } }],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const res = await dispatchPlatformAgentChat('openai', 'hi', [])
    expect(res.output).toBe('from openrouter after native fail')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const urls = fetchMock.mock.calls.map((c) => c[0])
    expect(urls[0]).toBe('https://api.openai.com/v1/chat/completions')
    expect(urls[1]).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  it('posts Anthropic messages for native Claude Sonnet 4.5', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    delete process.env.OPENROUTER_API_KEY
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: 'from claude' }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await dispatchPlatformAgentChat('claude', 'hi', [])
    expect(res.output).toBe('from claude')
    expect(res.model).toBe('claude-sonnet-4-5')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers).toMatchObject({
      'x-api-key': 'sk-ant-test',
    })
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe('claude-sonnet-4-5')
  })

  it('posts OpenAI-compatible chat completions for native Grok 4.3', async () => {
    process.env.XAI_API_KEY = 'xai-test'
    delete process.env.GROK_API_KEY
    delete process.env.OPENROUTER_API_KEY
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'from xai' } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await dispatchPlatformAgentChat('grok', 'hi', [])
    expect(res.output).toBe('from xai')
    expect(res.model).toBe('grok-4.3')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.x.ai/v1/chat/completions')
    expect(init.headers).toMatchObject({
      authorization: 'Bearer xai-test',
    })
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe('grok-4.3')
  })

  it('posts OpenAI-compatible chat completions for ChatGPT', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'from openai' } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await dispatchPlatformAgentChat('openai', 'hi', [])
    expect(res.output).toBe('from openai')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(init.headers).toMatchObject({
      authorization: 'Bearer sk-test',
    })
  })
})
