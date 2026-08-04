/**
 * Media URL helpers for chat — images (png/jpg/svg/…) and YouTube embeds.
 * 2ndbrain can attach transcript/summary previews keyed by YouTube id later.
 */

const IMAGE_EXT_RE =
  /\.(png|jpe?g|gif|webp|svg|avif|bmp|heic|heif)(?:[?#].*)?$/i

/** Bare http(s) URL (loose; we validate host/path separately). */
const URL_RE =
  /https?:\/\/[^\s<>"'`)\]]+/gi

const MD_IMAGE_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/
const MD_IMAGE_INLINE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

export type YoutubeId = string

export type ParsedMedia =
  | { kind: 'image'; url: string; alt: string }
  | { kind: 'youtube'; url: string; videoId: YoutubeId }

/** Optional enrichment from 2ndbrain (transcript / summary previews). */
export type MediaPreviewMeta = {
  title?: string
  summary?: string
  transcriptSnippet?: string
  source?: '2ndbrain' | 'oembed' | 'local'
}

export function isSafeHttpUrl(raw: string): boolean {
  const s = raw.trim()
  if (!s) return false
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    // Block obvious script injection schemes already filtered by protocol
    return Boolean(u.hostname)
  } catch {
    return false
  }
}

/** Relative /app or /uploads paths allowed for same-origin media. */
export function isSafeMediaSrc(raw: string): boolean {
  const s = raw.trim()
  if (!s) return false
  if (s.startsWith('/') && !s.startsWith('//')) {
    // path only — no protocol-relative
    return !s.includes('..')
  }
  return isSafeHttpUrl(s)
}

export function isImageUrl(raw: string): boolean {
  if (!isSafeMediaSrc(raw)) return false
  const s = raw.trim()
  if (IMAGE_EXT_RE.test(s)) return true
  // Common CDN patterns without file extension
  try {
    const u = new URL(s.startsWith('/') ? `https://local.invalid${s}` : s)
    const host = u.hostname.toLowerCase()
    if (
      host.includes('imgur.com') ||
      host.includes('i.imgur.com') ||
      host.includes('images.unsplash.com') ||
      host.includes('cdn.discordapp.com') ||
      host.includes('media.giphy.com')
    ) {
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

/**
 * Extract YouTube video id from common URL shapes:
 * - youtube.com/watch?v=
 * - youtu.be/
 * - youtube.com/embed/
 * - youtube.com/shorts/
 * - youtube-nocookie.com/embed/
 */
export function extractYoutubeId(raw: string): YoutubeId | null {
  if (!isSafeHttpUrl(raw)) return null
  try {
    const u = new URL(raw.trim())
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id && /^[\w-]{6,}$/.test(id) ? id : null
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const v = u.searchParams.get('v')
      if (v && /^[\w-]{6,}$/.test(v)) return v
      const parts = u.pathname.split('/').filter(Boolean)
      const embedIdx = parts.findIndex((p) => p === 'embed' || p === 'shorts' || p === 'live' || p === 'v')
      if (embedIdx >= 0 && parts[embedIdx + 1] && /^[\w-]{6,}$/.test(parts[embedIdx + 1]!)) {
        return parts[embedIdx + 1]!
      }
    }
  } catch {
    return null
  }
  return null
}

export function isYoutubeUrl(raw: string): boolean {
  return extractYoutubeId(raw) != null
}

export function youtubeWatchUrl(videoId: YoutubeId): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

export function youtubeEmbedUrl(videoId: YoutubeId): string {
  // Privacy-enhanced domain; no cookies until play in many browsers
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0`
}

export function youtubeThumbnailUrl(
  videoId: YoutubeId,
  quality: 'hqdefault' | 'mqdefault' | 'sddefault' | 'maxresdefault' = 'hqdefault',
): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${quality}.jpg`
}

export function parseMarkdownImageLine(line: string): { alt: string; url: string } | null {
  const m = line.trim().match(MD_IMAGE_RE)
  if (!m) return null
  const alt = m[1] ?? ''
  const url = (m[2] ?? '').trim()
  if (!isSafeMediaSrc(url) || !isImageUrl(url)) return null
  return { alt, url }
}

/** If a trimmed line is solely media, return a single block descriptor. */
export function parseStandaloneMediaLine(line: string): ParsedMedia | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const md = parseMarkdownImageLine(trimmed)
  if (md) return { kind: 'image', url: md.url, alt: md.alt }

  // Strip trailing punctuation often glued when pasting
  const cleaned = trimmed.replace(/[),.!?;:]+$/g, '')
  const yt = extractYoutubeId(cleaned)
  if (yt) return { kind: 'youtube', url: cleaned, videoId: yt }
  if (isImageUrl(cleaned)) return { kind: 'image', url: cleaned, alt: '' }

  return null
}

/**
 * Split a text line into alternating text / media-url / markdown-image parts
 * for inline rendering.
 */
export type InlineMediaPart =
  | { type: 'text'; value: string }
  | { type: 'image'; url: string; alt: string }
  | { type: 'youtube'; url: string; videoId: YoutubeId }
  | { type: 'link'; url: string; label: string }

export function splitInlineMedia(text: string): InlineMediaPart[] {
  const parts: InlineMediaPart[] = []
  // Combine MD images and bare URLs
  const combined = new RegExp(
    `${MD_IMAGE_INLINE_RE.source}|${URL_RE.source}`,
    'gi',
  )
  let last = 0
  let m: RegExpExecArray | null
  const re = new RegExp(combined.source, 'gi')
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', value: text.slice(last, m.index) })
    }
    const full = m[0]
    if (full.startsWith('![')) {
      const inner = full.match(/^!\[([^\]]*)\]\(([^)\s]+)/)
      const url = inner?.[2]?.trim() ?? ''
      const alt = inner?.[1] ?? ''
      if (isSafeMediaSrc(url) && isImageUrl(url)) {
        parts.push({ type: 'image', url, alt })
      } else {
        parts.push({ type: 'text', value: full })
      }
    } else {
      const cleaned = full.replace(/[),.!?;:]+$/g, '')
      const trail = full.slice(cleaned.length)
      const yt = extractYoutubeId(cleaned)
      if (yt) {
        parts.push({ type: 'youtube', url: cleaned, videoId: yt })
      } else if (isImageUrl(cleaned)) {
        parts.push({ type: 'image', url: cleaned, alt: '' })
      } else if (isSafeHttpUrl(cleaned)) {
        parts.push({ type: 'link', url: cleaned, label: cleaned })
      } else {
        parts.push({ type: 'text', value: full })
        last = m.index + full.length
        continue
      }
      if (trail) parts.push({ type: 'text', value: trail })
    }
    last = m.index + full.length
  }
  if (last < text.length) {
    parts.push({ type: 'text', value: text.slice(last) })
  }
  return parts.length > 0 ? parts : [{ type: 'text', value: text }]
}
