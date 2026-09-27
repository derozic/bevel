export const MAX_CHAT_IMAGES = 6
export const MAX_CHAT_IMAGE_BYTES = 8 * 1024 * 1024

export const ALLOWED_CHAT_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

const CONVERTIBLE_CHAT_IMAGE_TYPES = new Set([
  'image/tiff',
  'image/tif',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/x-png',
])

export const MAX_CHAT_VIDEO_BYTES = 32 * 1024 * 1024
export const MAX_CHAT_VIDEO_SECONDS = 30

export const ALLOWED_CHAT_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

const SAFE_SRC_RE =
  /^\/api\/chat\/images\/[a-z0-9]{8,40}\.(png|jpe?g|webp|gif|mp4|webm|mov)$/i
const IMAGE_MD_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g

export type ChatImageRef = {
  alt: string
  src: string
  kind: 'image' | 'video'
}

export function isChatVideoSrc(src: string): boolean {
  return /\.(mp4|webm|mov)$/i.test(src.split('?')[0] || '')
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
        alt: String(alt || '').trim() || (isChatVideoSrc(clean) ? 'clip' : 'image'),
        src: clean,
        kind: isChatVideoSrc(clean) ? 'video' : 'image',
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
  if (CONVERTIBLE_CHAT_IMAGE_TYPES.has(file.type)) return true
  if (!file.type && /\.(png|jpe?g|webp|gif|tiff?|heic|bmp)$/i.test(file.name || '')) {
    return true
  }
  return /\.(png|jpe?g|webp|gif)$/i.test(file.name)
}

function extForMime(type: string): string {
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  return 'png'
}

/** macOS/WKWebView often pastes TIFF or a File with an empty type. Draw to PNG. */
export async function normalizeChatImageFile(file: File): Promise<File | null> {
  if (file.size <= 0 || file.size > MAX_CHAT_IMAGE_BYTES) return null
  if (ALLOWED_CHAT_IMAGE_TYPES.has(file.type)) {
    if (file.name && /\.(png|jpe?g|webp|gif)$/i.test(file.name)) return file
    return new File([file], `paste.${extForMime(file.type)}`, {
      type: file.type,
      lastModified: file.lastModified,
    })
  }
  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    )
    bitmap.close()
    if (!blob || blob.size > MAX_CHAT_IMAGE_BYTES) return null
    const base = (file.name || 'paste').replace(/\.[^.]+$/, '') || 'paste'
    return new File([blob], `${base}.png`, { type: 'image/png' })
  } catch {
    if (ALLOWED_CHAT_IMAGE_TYPES.has(file.type)) return file
    return null
  }
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
    for (const file of Array.from(data.files)) {
      if (file.type && !file.type.startsWith('image/')) continue
      push(file)
    }
  }
  return out
}

export function clipboardPlainText(data: DataTransfer | null): string {
  if (!data) return ''
  return (data.getData('text/plain') || data.getData('text/uri-list') || '').trim()
}

export function clipboardHasImage(data: DataTransfer | null): boolean {
  return collectImageFiles(data).length > 0
}

export function isAllowedChatVideoFile(file: File): boolean {
  if (file.size <= 0 || file.size > MAX_CHAT_VIDEO_BYTES) return false
  if (ALLOWED_CHAT_VIDEO_TYPES.has(file.type)) return true
  return /\.(mp4|webm|mov)$/i.test(file.name)
}

export function collectVideoFiles(data: DataTransfer | null): File[] {
  if (!data) return []
  const out: File[] = []
  const seen = new Set<string>()
  const push = (file: File | null) => {
    if (!file || !isAllowedChatVideoFile(file)) return
    const key = `${file.name}:${file.size}:${file.lastModified}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(file)
  }
  if (data.items?.length) {
    for (const item of Array.from(data.items)) {
      if (item.kind !== 'file') continue
      if (item.type && !item.type.startsWith('video/')) continue
      push(item.getAsFile())
    }
  }
  if (out.length === 0 && data.files?.length) {
    for (const file of Array.from(data.files)) {
      if (file.type && !file.type.startsWith('video/')) continue
      push(file)
    }
  }
  return out
}

export function videoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement('video')
    el.preload = 'metadata'
    el.onloadedmetadata = () => {
      const d = el.duration
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(d) ? d : 0)
    }
    el.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that clip'))
    }
    el.src = url
  })
}

export async function normalizeChatVideoFile(file: File): Promise<File | null> {
  if (!isAllowedChatVideoFile(file)) return null
  const duration = await videoDurationSeconds(file)
  if (duration > MAX_CHAT_VIDEO_SECONDS) {
    throw new Error(`Clips are ${MAX_CHAT_VIDEO_SECONDS} seconds max`)
  }
  return file
}

export async function readImagesFromClipboard(): Promise<File[]> {
  const read = navigator.clipboard?.read
  if (!read) return []
  try {
    const items = await read.call(navigator.clipboard)
    const files: File[] = []
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'))
      if (!type) continue
      const blob = await item.getType(type)
      files.push(
        new File([blob], `paste.${extForMime(blob.type || type)}`, {
          type: blob.type || type,
        }),
      )
    }
    return files
  } catch {
    return []
  }
}
