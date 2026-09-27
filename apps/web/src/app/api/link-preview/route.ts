import { NextResponse } from 'next/server'
import { classifyBevelUrl, unfurlMeta } from '@bevel/realtime-client/link-preview'

export const runtime = 'nodejs'

function publicUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0' ||
    host === '::1'
  ) {
    return null
  }
  if (
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return null
  }
  return url
}

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

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('url') || ''
  const url = publicUrl(raw)
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
    const title = meta(html, 'og:title') || titleTag || url.hostname
    const description = meta(html, 'og:description') || meta(html, 'description')
    let image = meta(html, 'og:image')
    if (image && image.startsWith('/')) image = new URL(image, url).toString()
    const kind = classifyBevelUrl(url.toString())
    const { kicker, cta } = unfurlMeta(kind)
    return NextResponse.json({
      url: url.toString(),
      site: url.hostname.replace(/^www\./, ''),
      title: title.slice(0, 180),
      description: description.slice(0, 240),
      image: image && publicUrl(image) ? image : null,
      kind,
      kicker,
      cta,
    })
  } catch {
    const kind = classifyBevelUrl(url.toString())
    const { kicker, cta } = unfurlMeta(kind)
    return NextResponse.json({
      url: url.toString(),
      site: url.hostname.replace(/^www\./, ''),
      title: url.hostname.replace(/^www\./, ''),
      description: '',
      image: null,
      kind,
      kicker,
      cta,
    })
  }
}
