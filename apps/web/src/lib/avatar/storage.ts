/**
 * Profile avatar files on disk (EC2 data dir — not localStorage).
 * Path: {dataRoot}/uploads/avatars/{tenant}/{userKey}/avatar.{ext}
 */

import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024
export const AVATAR_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function dataRoot(): string {
  if (process.env.BEVEL_DATA_ROOT) return process.env.BEVEL_DATA_ROOT
  // apps/web cwd → monorepo data/
  const fromWeb = join(process.cwd(), '../../data')
  const fromRoot = join(process.cwd(), 'data')
  if (existsSync(join(process.cwd(), 'apps/web'))) return fromRoot
  return fromWeb
}

/** Stable filesystem-safe key from email or id. */
export function avatarUserKey(userIdOrEmail: string): string {
  const raw = userIdOrEmail.trim().toLowerCase()
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

export function avatarDir(tenantSlug: string, userKey: string): string {
  const safeTenant = tenantSlug.replace(/[^a-z0-9-_]/gi, '_').toLowerCase() || 'default'
  return join(dataRoot(), 'uploads', 'avatars', safeTenant, userKey)
}

export function detectImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png'
  }
  // GIF
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  ) {
    return 'image/gif'
  }
  // WEBP (RIFF....WEBP)
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

export function extForMime(mime: string): string {
  return EXT_BY_MIME[mime] || 'bin'
}

/** Find existing avatar file in user dir (any allowed ext). */
export function findAvatarFile(
  tenantSlug: string,
  userKey: string,
): { path: string; mime: string; ext: string } | null {
  const dir = avatarDir(tenantSlug, userKey)
  if (!existsSync(dir)) return null
  try {
    const files = readdirSync(dir)
    for (const f of files) {
      const m = /^avatar\.(jpg|jpeg|png|webp|gif)$/i.exec(f)
      if (!m) continue
      const ext = m[1]!.toLowerCase() === 'jpeg' ? 'jpg' : m[1]!.toLowerCase()
      const mime =
        ext === 'jpg'
          ? 'image/jpeg'
          : ext === 'png'
            ? 'image/png'
            : ext === 'webp'
              ? 'image/webp'
              : 'image/gif'
      return { path: join(dir, f), mime, ext }
    }
  } catch {
    return null
  }
  return null
}

export function ensureAvatarDir(tenantSlug: string, userKey: string): string {
  const dir = avatarDir(tenantSlug, userKey)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o755 })
  }
  return dir
}

/** Remove previous avatar.* files before writing a new one. */
export function clearAvatarFiles(tenantSlug: string, userKey: string): void {
  const dir = avatarDir(tenantSlug, userKey)
  if (!existsSync(dir)) return
  try {
    for (const f of readdirSync(dir)) {
      if (/^avatar\./i.test(f)) {
        unlinkSync(join(dir, f))
      }
    }
  } catch {
    /* ignore */
  }
}

export function publicAvatarUrl(opts: {
  userKey: string
  tenantSlug: string
  version?: string | number
}): string {
  const q = new URLSearchParams()
  q.set('u', opts.userKey)
  q.set('t', opts.tenantSlug)
  if (opts.version != null) q.set('v', String(opts.version))
  return `/api/me/avatar?${q.toString()}`
}
