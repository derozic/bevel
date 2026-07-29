import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  AVATAR_ALLOWED_MIME,
  AVATAR_MAX_BYTES,
  avatarUserKey,
  clearAvatarFiles,
  detectImageMime,
  ensureAvatarDir,
  extForMime,
  findAvatarFile,
  publicAvatarUrl,
} from '@/lib/avatar/storage'

export const runtime = 'nodejs'

function tenantFromSession(session: {
  tenantSlug?: string | null
}): string {
  return (session.tenantSlug || 'default').toLowerCase()
}

/**
 * GET /api/me/avatar?u={userKey}&t={tenant}
 * Serves custom avatar bytes. u defaults to current user when signed in.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const session = await auth()
  const qUser = searchParams.get('u')
  const qTenant = searchParams.get('t')

  let userKey = qUser
  let tenant = qTenant?.toLowerCase()

  if (!userKey && session?.user) {
    userKey = avatarUserKey(
      session.user.id || session.user.email || 'anon',
    )
  }
  if (!tenant && session?.user) {
    tenant = tenantFromSession(session)
  }

  if (!userKey || !tenant) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Only allow alphanumeric hash keys (no path traversal)
  if (!/^[a-f0-9]{16,64}$/i.test(userKey)) {
    return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
  }
  if (!/^[a-z0-9_-]+$/i.test(tenant)) {
    return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 })
  }

  const found = findAvatarFile(tenant, userKey)
  if (!found) {
    return NextResponse.json({ error: 'No avatar' }, { status: 404 })
  }

  try {
    const buf = await readFile(found.path)
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': found.mime,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Content-Length': String(buf.length),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

/**
 * POST /api/me/avatar — multipart field `file`
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userKey = avatarUserKey(
    session.user.id || session.user.email || 'anon',
  )
  const tenant = tenantFromSession(session)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json(
      { error: 'Expected multipart form with file' },
      { status: 400 },
    )
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }

  if (file.size <= 0 || file.size > AVATAR_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Image must be between 1 byte and ${AVATAR_MAX_BYTES / (1024 * 1024)} MB`,
      },
      { status: 400 },
    )
  }

  const ab = await file.arrayBuffer()
  const buf = Buffer.from(ab)
  const mime = detectImageMime(buf)
  if (!mime || !AVATAR_ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      {
        error: 'Use JPEG, PNG, WebP, or GIF (SVG not allowed)',
      },
      { status: 400 },
    )
  }

  // Client Content-Type is advisory only — trust magic bytes
  const ext = extForMime(mime)
  const dir = ensureAvatarDir(tenant, userKey)
  clearAvatarFiles(tenant, userKey)
  const dest = join(dir, `avatar.${ext}`)
  await writeFile(dest, buf, { mode: 0o644 })

  const version = Date.now()
  const photoUrl = publicAvatarUrl({
    userKey,
    tenantSlug: tenant,
    version,
  })

  return NextResponse.json({
    ok: true,
    photoUrl,
    mime,
    bytes: buf.length,
    userKey,
    tenantSlug: tenant,
  })
}

/**
 * DELETE /api/me/avatar — remove custom photo
 */
export async function DELETE() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userKey = avatarUserKey(
    session.user.id || session.user.email || 'anon',
  )
  const tenant = tenantFromSession(session)
  clearAvatarFiles(tenant, userKey)

  return NextResponse.json({ ok: true, photoUrl: '' })
}
