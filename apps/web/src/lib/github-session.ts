import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

function authSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'bevel-dev-auth-secret-not-for-production'
  )
}

function useSecureCookie(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.NEXTAUTH_URL?.startsWith('https') === true ||
    process.env.AUTH_URL?.startsWith('https') === true
  )
}

/**
 * Read GitHub access token from the Auth.js JWT (server-only).
 * Never put this on the client session object.
 */
export async function getGitHubAccessToken(
  request: NextRequest | Request,
): Promise<{
  accessToken?: string
  githubLogin?: string
  repoWrite?: boolean
}> {
  try {
    const secure = useSecureCookie()
    const token = await getToken({
      req: request as NextRequest,
      secret: authSecret(),
      secureCookie: secure,
      cookieName: secure
        ? '__Secure-authjs.session-token'
        : 'authjs.session-token',
    })
    if (!token) return {}
    return {
      accessToken:
        typeof token.githubAccessToken === 'string'
          ? token.githubAccessToken
          : undefined,
      githubLogin:
        typeof token.githubLogin === 'string' ? token.githubLogin : undefined,
      repoWrite: token.repoWrite === true,
    }
  } catch {
    return {}
  }
}
