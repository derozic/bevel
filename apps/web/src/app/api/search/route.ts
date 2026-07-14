import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export type SearchHitDto = {
  key?: string
  messageId: string
  sessionId: string
  kind: 'channel' | 'session'
  channelSlug?: string
  speaker: string
  speakerType: string
  agentId?: string
  body: string
  ts: number
  score: number
  snippet: string
  href: string
}

/**
 * Proxy to realtime conversation search index.
 * Bookmark-style: each hit points at a concrete message deep-link.
 */
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const limit = url.searchParams.get('limit') ?? '25'

  if (!q.trim()) {
    return NextResponse.json({ q: '', count: 0, hits: [] })
  }

  const realtimeUrl =
    process.env.REALTIME_URL ??
    process.env.NEXT_PUBLIC_REALTIME_URL ??
    'https://realtime.bevel.lvh.me'

  const token =
    session.realtimeToken ??
    (session as { apiToken?: string }).apiToken ??
    ''

  try {
    const res = await fetch(
      `${realtimeUrl.replace(/\/$/, '')}/api/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`,
      {
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : undefined,
        cache: 'no-store',
      },
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json(
        { error: 'Search backend failed', detail: text.slice(0, 200) },
        { status: 502 },
      )
    }

    const data = (await res.json()) as {
      q: string
      count: number
      indexSize?: number
      hits: SearchHitDto[]
    }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Search unavailable',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 503 },
    )
  }
}
