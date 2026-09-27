import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { hasFeature } from '@bevel/schema'
import { getTenantFromRequest } from '@bevel/tenant-config'
import { auth } from '@/auth'
import {
  CHAT_IMAGE_MAX_BYTES,
  CHAT_VIDEO_MAX_BYTES,
  ensureChatImagesDir,
  extForChatImage,
  isAllowedChatImageMime,
  isAllowedChatVideoMime,
  isChatSvgExt,
  isChatVideoExt,
} from '@/lib/chat-image-store'
import { sanitizeSvg, SVG_MAX_BYTES } from '@/lib/sanitize-svg'

export const runtime = 'nodejs'

/**
 * Upload a chat image or (Pro) short video. multipart field `file`.
 * Returns `{ url, name, kind }` for markdown embedding in the thread.
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

  const ext = extForChatImage(file)
  const isVideo =
    isChatVideoExt(ext) ||
    (file.type ? isAllowedChatVideoMime(file.type) : false)

  if (isVideo) {
    const tenant = await getTenantFromRequest()
    if (!hasFeature(tenant, 'chatVideo')) {
      return NextResponse.json(
        {
          error: 'Short video clips are on the Pro plan.',
          upgradeRequired: true,
        },
        { status: 402 },
      )
    }
    if (file.size <= 0 || file.size > CHAT_VIDEO_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Clips must be under ${Math.round(CHAT_VIDEO_MAX_BYTES / (1024 * 1024))} MB`,
        },
        { status: 400 },
      )
    }
    if (file.type && !isAllowedChatVideoMime(file.type) && !isChatVideoExt(ext)) {
      return NextResponse.json(
        { error: 'Use MP4, WebM, or MOV (30s max)' },
        { status: 400 },
      )
    }
  } else {
    if (file.size <= 0 || file.size > CHAT_IMAGE_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Image must be 1–${Math.round(CHAT_IMAGE_MAX_BYTES / (1024 * 1024))} MB`,
        },
        { status: 400 },
      )
    }
    if (!ext || (file.type && !isAllowedChatImageMime(file.type) && !ext)) {
      return NextResponse.json(
        { error: 'Use PNG, JPEG, WebP, GIF, SVG, or a short MP4/WebM/MOV' },
        { status: 400 },
      )
    }
    if (
      (isChatSvgExt(ext) || file.type === 'image/svg+xml') &&
      file.size > SVG_MAX_BYTES
    ) {
      return NextResponse.json(
        { error: 'SVG must be under 512 KB' },
        { status: 400 },
      )
    }
  }

  const id = randomBytes(12).toString('hex')
  const filename = `${id}${ext}`
  const dir = await ensureChatImagesDir()
  let bytes: Buffer
  if (isChatSvgExt(ext) || file.type === 'image/svg+xml') {
    const clean = sanitizeSvg(await file.text())
    if (!clean) {
      return NextResponse.json(
        { error: 'That SVG did not pass the safety lint' },
        { status: 400 },
      )
    }
    bytes = Buffer.from(clean, 'utf8')
  } else {
    bytes = Buffer.from(await file.arrayBuffer())
  }
  await writeFile(join(dir, filename), bytes)

  const name = (file.name || (isVideo ? 'clip' : 'image'))
    .replace(/[^\w.\-]+/g, '_')
    .slice(0, 80)
  return NextResponse.json({
    ok: true,
    url: `/api/chat/images/${filename}`,
    name,
    kind: isVideo ? 'video' : 'image',
  })
}
