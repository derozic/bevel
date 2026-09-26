const URL_RE = /https?:\/\/[^\s<>"']+/i

export type LinkPreview = {
  url: string
  site: string
  title: string
  description: string
  image: string | null
}

export function firstHttpUrl(text: string): string | null {
  const match = text.match(URL_RE)
  if (!match) return null
  const raw = match[0].replace(/[),.]+$/, '')
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

export function siteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
