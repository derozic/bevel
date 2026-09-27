import { NextResponse } from 'next/server'
import {
  classifyBevelUrl,
  firstPartyBlurb,
  previewableUrl,
  titleFromBevelUrl,
  unfurlMeta,
} from '@bevel/realtime-client/link-preview'

export const runtime = 'nodejs'

function meta(html: string, key: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      return match[1]
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim()
    }
  }
  return ''
}

function envelope(url: URL, title: string, description: string, image: string | null) {
  const kind = classifyBevelUrl(url.toString())
  const { kicker, cta } = unfurlMeta(kind)
  const host = url.hostname.replace(/^www\./, '')
  const derived = titleFromBevelUrl(url.toString(), kind)
  const scraped = title.trim()
  const useDerived = kind !== 'generic' && (!scraped || scraped === host || scraped === url.hostname)
  return {
    url: url.toString(),
    site: host,
    title: (useDerived ? derived : scraped).slice(0, 180),
    description: (description.trim() || firstPartyBlurb(kind)).slice(0, 240),
    image: image && previewableUrl(image) ? image : null,
    kind,
    kicker,
    cta,
  }
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
    const title = meta(html, 'og:title') || titleTag || ''
    const description = meta(html, 'og:description') || meta(html, 'description')
    let image = meta(html, 'og:image')
    if (image && image.startsWith('/')) image = new URL(image, url).toString()
    return NextResponse.json(envelope(url, title, description, image || null))
  } catch {
    return NextResponse.json(envelope(url, '', '', null))
  }
}
