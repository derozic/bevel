import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { is2x4mSuiteHost } from '@bevel/auth/config'

function authSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'bevel-dev-auth-secret-not-for-production'
  )
}

function requestHost(request: NextRequest | Request): string {
  try {
    const h =
      (request as NextRequest).headers?.get?.('x-forwarded-host') ||
      (request as NextRequest).headers?.get?.('host') ||
      ''
    return h.toLowerCase().split(':')[0] || ''
  } catch {
    return ''
  }
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
    const host = requestHost(request)
    const suite = host ? is2x4mSuiteHost(host) : false
    // Match packages/auth cookie names for this host family.
    const cookieNames = suite
      ? ['next-auth.session-token']
      : ['__Secure-authjs.session-token', 'authjs.session-token']

    let token = null
    for (const cookieName of cookieNames) {
      token = await getToken({
        req: request as NextRequest,
        secret: authSecret(),
        secureCookie: !suite && cookieName.startsWith('__Secure-'),
        cookieName,
      })
      if (token) break
    }
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
