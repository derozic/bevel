import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  CHAT_IMAGE_FILENAME_RE,
  chatImagesDir,
} from '@/lib/chat-image-store'

export const runtime = 'nodejs'

const CONTENT_TYPE: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml; charset=utf-8',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  const { filename } = await context.params
  const safe = decodeURIComponent(filename || '')
  if (!CHAT_IMAGE_FILENAME_RE.test(safe)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const bytes = await readFile(join(chatImagesDir(), safe))
    const ext = safe.split('.').pop()?.toLowerCase() || 'png'
    const headers: Record<string, string> = {
      'Content-Type': CONTENT_TYPE[ext] || 'application/octet-stream',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    }
    if (ext === 'svg') {
      headers['Content-Security-Policy'] = "default-src 'none'; sandbox"
      headers['Content-Disposition'] = 'inline'
    }
    return new NextResponse(bytes, {
      status: 200,
      headers,
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
