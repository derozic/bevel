export const MAX_CHAT_IMAGES = 6
export const MAX_CHAT_IMAGE_BYTES = 8 * 1024 * 1024

export const ALLOWED_CHAT_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

const SAFE_SRC_RE =
  /^\/api\/chat\/images\/[a-z0-9]{8,40}\.(png|jpe?g|webp|gif)$/i
const IMAGE_MD_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g

export type ChatImageRef = {
  alt: string
  src: string
}

export function isSafeChatImageSrc(src: string): boolean {
  const value = src.trim()
  if (!value) return false
  if (value.startsWith('blob:') || value.startsWith('data:')) return false
  return SAFE_SRC_RE.test(value)
}

export function chatImageMarkdown(alt: string, src: string): string {
  const safeAlt = alt.replace(/[[\]\n\r]/g, ' ').trim() || 'image'
  return `![${safeAlt}](${src})`
}

export function hasChatImageMarkdown(text: string): boolean {
  return extractChatImages(text).images.length > 0
}

/** Pull safe `![alt](src)` refs out of a message so the thread can render them. */
export function extractChatImages(text: string): {
  body: string
  images: ChatImageRef[]
} {
  const raw = typeof text === 'string' ? text : ''
  const images: ChatImageRef[] = []
  const body = raw
    .replace(IMAGE_MD_RE, (_full, alt: string, src: string) => {
      const clean = String(src || '').trim()
      if (!isSafeChatImageSrc(clean)) return _full
      images.push({
        alt: String(alt || '').trim() || 'image',
        src: clean,
      })
      return ''
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { body, images }
}

export function isAllowedChatImageFile(file: File): boolean {
  if (file.size <= 0 || file.size > MAX_CHAT_IMAGE_BYTES) return false
  if (ALLOWED_CHAT_IMAGE_TYPES.has(file.type)) return true
  return /\.(png|jpe?g|webp|gif)$/i.test(file.name)
}

export function collectImageFiles(data: DataTransfer | null): File[] {
  if (!data) return []
  const out: File[] = []
  const seen = new Set<string>()
  const push = (file: File | null) => {
    if (!file || !isAllowedChatImageFile(file)) return
    const key = `${file.name}:${file.size}:${file.lastModified}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(file)
  }
  if (data.items?.length) {
    for (const item of Array.from(data.items)) {
      if (item.kind !== 'file') continue
      if (item.type && !item.type.startsWith('image/')) continue
      push(item.getAsFile())
    }
  }
  if (out.length === 0 && data.files?.length) {
    for (const file of Array.from(data.files)) push(file)
  }
  return out
}
