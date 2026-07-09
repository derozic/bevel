import { jwtVerify } from 'jose'

export type RealtimeAuth = {
  email: string
  name?: string
  sub: string
  role?: string
  picture?: string
  /** Minted when user can put agents on work (admin, allowlist, or repo write). */
  repoWrite?: boolean
  /** Repos this session may target (owner/name). */
  workRepos?: string[]
}

function secretKey(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'development') {
      return new TextEncoder().encode('agents-dev-auth-secret-not-for-production')
    }
    return null
  }
  return new TextEncoder().encode(secret)
}

export async function verifyAuthToken(token: string): Promise<RealtimeAuth | null> {
  const key = secretKey()
  if (!key) return null
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] })
    if (payload.type !== 'realtime') return null
    const email = payload.email
    if (typeof email !== 'string' || !email) return null
    return {
      email,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      sub: payload.sub ?? email,
      role: typeof payload.role === 'string' ? payload.role : 'user',
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
      repoWrite: payload.repoWrite === true,
      workRepos:
        typeof payload.workRepos === 'string'
          ? payload.workRepos.split(',').map((r) => r.trim()).filter(Boolean)
          : undefined,
    }
  } catch {
    return null
  }
}

export function extractBearer(req: { headers: { authorization?: string } }): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}