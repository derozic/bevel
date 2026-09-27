import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export const CHAT_IMAGE_MAX_BYTES = 8 * 1024 * 1024
export const CHAT_VIDEO_MAX_BYTES = 32 * 1024 * 1024
export const CHAT_IMAGE_FILENAME_RE =
  /^[a-z0-9]{8,40}\.(png|jpe?g|webp|gif|svg|mp4|webm|mov)$/i

const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
}

export function chatImagesDir(): string {
  const root =
    process.env.BEVEL_DATA_ROOT || join(process.cwd(), '..', '..', 'data')
  return join(root, 'chat-images')
}

export async function ensureChatImagesDir(): Promise<string> {
  const dir = chatImagesDir()
  await mkdir(dir, { recursive: true })
  return dir
}

export function extForChatImage(file: { name?: string; type?: string }): string {
  const fromName = (file.name || '')
    .toLowerCase()
    .match(/\.(png|jpe?g|webp|gif|svg|mp4|webm|mov)$/)
  if (fromName) return fromName[0] === '.jpeg' ? '.jpg' : fromName[0]
  return MIME_EXT[file.type || ''] || ''
}

export function isAllowedChatImageMime(type: string): boolean {
  return Boolean(MIME_EXT[type]) && (type.startsWith('image/') || type === 'image/svg+xml')
}

export function isChatSvgExt(ext: string): boolean {
  return /^\.svg$/i.test(ext)
}

export function isAllowedChatVideoMime(type: string): boolean {
  return type.startsWith('video/') && Boolean(MIME_EXT[type])
}

export function isChatVideoExt(ext: string): boolean {
  return /^\.(mp4|webm|mov)$/i.test(ext)
}
