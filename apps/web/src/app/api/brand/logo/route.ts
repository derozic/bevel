import { mkdir, writeFile, readdir, unlink } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import type { DaypartId } from '@bevel/schema'
import { DAYPART_LOGO_SLOTS } from '@/lib/workspace-logo'

export const runtime = 'nodejs'

const MAX_BYTES = 512 * 1024 // 512 KB
const ALLOWED_EXT = new Set(['.svg', '.png', '.webp', '.jpg', '.jpeg'])
const DAYPARTS = new Set<string>(DAYPART_LOGO_SLOTS)

function brandDir(slug: string): string {
  // apps/web/public/brand/{slug}
  return join(process.cwd(), 'public', 'brand', slug)
}

function tenantLogosDir(slug: string): string {
  const root =
    process.env.BEVEL_TENANTS_ROOT ||
    join(process.cwd(), '..', '..', 'tenants')
  return join(root, slug, 'logos')
}

/**
 * List current daypart logo slots for the active tenant.
 * GET /api/brand/logo
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const slug = session.tenantSlug || '2x4m'
  const dir = brandDir(slug)
  const logos: Partial<Record<DaypartId, string>> = {}
  let fallback: string | undefined

  try {
    const files = await readdir(dir)
    for (const file of files) {
      const m = /^logo-(morning|midday|afternoon|night)\.(svg|png|webp|jpe?g)$/i.exec(
        file,
      )
      if (m) {
        logos[m[1].toLowerCase() as DaypartId] = `/brand/${slug}/${file}`
      }
      if (/^logo\.(svg|png|webp|jpe?g)$/i.test(file)) {
        fallback = `/brand/${slug}/${file}`
      }
    }
  } catch {
    // no brand dir yet
  }

  return NextResponse.json({
    ok: true,
    tenantSlug: slug,
    slots: DAYPART_LOGO_SLOTS,
    logos,
    fallback,
    maxBytes: MAX_BYTES,
    allowed: [...ALLOWED_EXT],
  })
}

/**
 * Upload one of four day-part workspace logos.
 * multipart: daypart=morning|midday|afternoon|night, file=<image>
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const slug = session.tenantSlug || '2x4m'

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart form' }, { status: 400 })
  }

  const daypartRaw = String(form.get('daypart') || '').toLowerCase()
  if (!DAYPARTS.has(daypartRaw)) {
    return NextResponse.json(
      {
        error: 'daypart required',
        slots: DAYPART_LOGO_SLOTS,
        hint: 'Upload four unique logos — one per day part.',
      },
      { status: 400 },
    )
  }
  const daypart = daypartRaw as DaypartId
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File must be 1–${MAX_BYTES} bytes` },
      { status: 400 },
    )
  }

  const ext = extname(file.name || '').toLowerCase() || guessExt(file.type)
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: `Allowed types: ${[...ALLOWED_EXT].join(', ')}` },
      { status: 400 },
    )
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const filename = `logo-${daypart}${ext}`
  const publicDir = brandDir(slug)
  await mkdir(publicDir, { recursive: true })

  // Remove prior uploads for this daypart (any extension)
  try {
    const existing = await readdir(publicDir)
    await Promise.all(
      existing
        .filter((f) =>
          new RegExp(`^logo-${daypart}\\.(svg|png|webp|jpe?g)$`, 'i').test(f),
        )
        .map((f) => unlink(join(publicDir, f)).catch(() => undefined)),
    )
  } catch {
    /* empty */
  }

  await writeFile(join(publicDir, filename), bytes)

  // Mirror into tenant logos/ for declarative config discovery
  try {
    const tdir = tenantLogosDir(slug)
    await mkdir(tdir, { recursive: true })
    await writeFile(join(tdir, filename), bytes)
  } catch {
    // non-fatal if tenants root is not writable from this process
  }

  const url = `/brand/${slug}/${filename}`
  return NextResponse.json({
    ok: true,
    daypart,
    url,
    // cache-buster for immediate UI refresh
    urlWithBust: `${url}?v=${Date.now()}`,
  })
}

function guessExt(mime: string): string {
  if (mime === 'image/svg+xml') return '.svg'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/jpeg') return '.jpg'
  return ''
}
