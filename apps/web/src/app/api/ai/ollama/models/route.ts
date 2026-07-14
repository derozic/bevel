import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { OLLAMA_DEFAULT_BASE_URL } from '@bevel/schema'
import { listOllamaModels } from '@/lib/ai-providers'

export const runtime = 'nodejs'

/**
 * List models from the local Ollama daemon (Mac default :11434).
 * Query: ?baseUrl=http://127.0.0.1:11434/v1
 */
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const baseUrl =
    url.searchParams.get('baseUrl') ||
    process.env.OLLAMA_BASE_URL ||
    OLLAMA_DEFAULT_BASE_URL

  const result = await listOllamaModels(baseUrl)
  return NextResponse.json({
    ...result,
    defaultBaseUrl: OLLAMA_DEFAULT_BASE_URL,
    hint: result.ok
      ? undefined
      : 'Start Ollama on this Mac: open the Ollama app or run `ollama serve`',
  })
}
