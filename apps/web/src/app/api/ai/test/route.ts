import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { AI_PROVIDER_IDS, type AiProviderId } from '@bevel/schema'
import { testAiProvider } from '@/lib/ai-providers'

export const runtime = 'nodejs'

const ALLOWED = new Set<string>(AI_PROVIDER_IDS)

/**
 * Validate an AI provider key (and custom base URL / model).
 * Key is used only for this request — never written to disk or logs.
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    provider?: string
    apiKey?: string
    baseUrl?: string
    modelId?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const provider = (body.provider || '').toLowerCase()
  if (!ALLOWED.has(provider)) {
    return NextResponse.json(
      { error: `provider must be one of: ${AI_PROVIDER_IDS.join(', ')}` },
      { status: 400 },
    )
  }

  const apiKey = (body.apiKey || '').trim()
  const isOllama =
    provider === 'ollama' ||
    /127\.0\.0\.1:11434|localhost:11434/i.test(body.baseUrl || '')

  if (!apiKey && !isOllama) {
    return NextResponse.json({ error: 'apiKey required' }, { status: 400 })
  }

  if (apiKey.length > 8_192) {
    return NextResponse.json({ error: 'apiKey too long' }, { status: 400 })
  }

  const result = await testAiProvider({
    provider: provider as AiProviderId,
    apiKey: apiKey || 'ollama',
    baseUrl: body.baseUrl,
    modelId: body.modelId,
  })

  return NextResponse.json({
    ...result,
    // Never echo the key
    keyPreview: apiKey
      ? apiKey.length > 10
        ? `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`
        : '••••'
      : 'local',
  })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    providers: AI_PROVIDER_IDS,
    ollama: {
      baseUrl: 'http://127.0.0.1:11434/v1',
      modelsPath: '/api/ai/ollama/models',
    },
    customPresets: [
      {
        modelId: 'llama3.2:latest',
        baseUrl: 'http://127.0.0.1:11434/v1',
        label: 'Ollama Mac',
      },
      { modelId: 'z-ai/glm-5.2', baseUrl: 'https://openrouter.ai/api/v1' },
      {
        modelId: 'moonshotai/kimi-k2.7-code',
        baseUrl: 'https://openrouter.ai/api/v1',
      },
    ],
  })
}
