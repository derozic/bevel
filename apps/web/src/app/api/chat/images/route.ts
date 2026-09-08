import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  CHAT_IMAGE_MAX_BYTES,
  ensureChatImagesDir,
  extForChatImage,
  isAllowedChatImageMime,
} from '@/lib/chat-image-store'

export const runtime = 'nodejs'

/**
 * Upload a chat image. multipart field `file`.
 * Returns `{ url, name }` for markdown embedding in the thread.
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart form' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }
  if (file.size <= 0 || file.size > CHAT_IMAGE_MAX_BYTES) {
    return NextResponse.json(
      { error: `Image must be 1–${Math.round(CHAT_IMAGE_MAX_BYTES / (1024 * 1024))} MB` },
      { status: 400 },
    )
  }

  const ext = extForChatImage(file)
  if (!ext || (file.type && !isAllowedChatImageMime(file.type) && !ext)) {
    return NextResponse.json(
      { error: 'Use PNG, JPEG, WebP, or GIF' },
      { status: 400 },
    )
  }
  if (file.type && file.type.startsWith('image/') && !isAllowedChatImageMime(file.type) && ext === '') {
    return NextResponse.json({ error: 'Use PNG, JPEG, WebP, or GIF' }, { status: 400 })
  }

  const id = randomBytes(12).toString('hex')
  const filename = `${id}${ext}`
  const dir = await ensureChatImagesDir()
  const bytes = Buffer.from(await file.arrayBuffer())
  await writeFile(join(dir, filename), bytes)

  const name = (file.name || 'image').replace(/[^\w.\-]+/g, '_').slice(0, 80)
  return NextResponse.json({
    ok: true,
    url: `/api/chat/images/${filename}`,
    name,
  })
}
