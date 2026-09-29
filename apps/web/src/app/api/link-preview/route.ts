import { NextResponse } from 'next/server'
import { previewableUrl, unfurlEnvelope } from '@bevel/realtime-client/link-preview'

export const runtime = 'nodejs'

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function meta(html: string, key: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return decodeEntities(match[1])
  }
  return ''
}

function jsonLdNodes(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const graph = (data as Record<string, unknown>)['@graph']
    if (Array.isArray(graph)) return graph
  }
  return [data]
}

function jsonLdName(html: string): string {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    try {
      for (const node of jsonLdNodes(JSON.parse(match[1].trim()))) {
        if (!node || typeof node !== 'object') continue
        const record = node as Record<string, unknown>
        for (const key of ['name', 'headline', 'title'] as const) {
          const value = record[key]
          if (typeof value === 'string' && value.trim()) return decodeEntities(value)
        }
      }
    } catch {
      continue
    }
  }
  return ''
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('url') || ''
  const url = previewableUrl(raw)
  if (!url) {
    return NextResponse.json({ error: 'That link cannot be previewed' }, { status: 400 })
  }
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(4500),
      headers: { 'User-Agent': 'BevelLinkPreview/1.0', Accept: 'text/html' },
    })
    const html = (await res.text()).slice(0, 180_000)
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || ''
    const title = meta(html, 'og:title') || jsonLdName(html) || titleTag || ''
    const description = meta(html, 'og:description') || meta(html, 'description')
    let image = meta(html, 'og:image')
    if (image && image.startsWith('/')) image = new URL(image, url).toString()
    return NextResponse.json(
      unfurlEnvelope({
        url: url.toString(),
        title,
        description,
        image: image || null,
      }),
    )
  } catch {
    return NextResponse.json(
      unfurlEnvelope({ url: url.toString(), title: '', description: '', image: null }),
    )
  }
}
