import { SignJWT } from 'jose'

export function resolveAuthSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET
  if (process.env.NODE_ENV === 'development') {
    return 'bevel-dev-auth-secret-not-for-production'
  }
  throw new Error('AUTH_SECRET is required in production')
}

function jwtSecret(): Uint8Array {
  return new TextEncoder().encode(resolveAuthSecret())
}

export async function mintApiToken(payload: {
  email: string
  user_id: string
  role: string
  tenantId?: string
}): Promise<string> {
  const claims: Record<string, string> = {
    email: payload.email,
    user_id: payload.user_id,
    role: payload.role,
    type: 'access',
  }
  if (payload.tenantId) claims.tenantId = payload.tenantId

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(jwtSecret())
}

export async function mintRealtimeToken(payload: {
  tenantId: string
  namespace: string
  email: string
  name?: string
  sub: string
  role: string
  picture?: string
  repoWrite?: boolean
  workRepos?: string[]
  githubLogin?: string
}): Promise<string> {
  const claims: Record<string, string | boolean> = {
    email: payload.email,
    role: payload.role,
    type: 'realtime',
    tenantId: payload.tenantId,
    namespace: payload.namespace,
  }
  if (payload.name) claims.name = payload.name
  if (payload.picture) claims.picture = payload.picture
  if (payload.repoWrite) claims.repoWrite = true
  if (payload.workRepos?.length) claims.workRepos = payload.workRepos.join(',')
  if (payload.githubLogin) claims.githubLogin = payload.githubLogin

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(jwtSecret())
}