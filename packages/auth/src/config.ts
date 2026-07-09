import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import type { NextAuthConfig } from 'next-auth'
import type { Tenant } from '@bevel/schema'
import { mintRealtimeToken } from './tokens'

export interface CreateTenantAuthConfigOptions {
  tenant: Tenant
  trustHost?: boolean
}

function isEmailAllowed(email: string, tenant: Tenant): boolean {
  const normalized = email.toLowerCase()
  if (tenant.auth.allowedEmails?.some((e) => e.toLowerCase() === normalized)) {
    return true
  }
  const domain = normalized.split('@')[1]
  if (domain && tenant.auth.allowedEmailDomains?.includes(domain)) {
    return true
  }
  if (
    !tenant.auth.allowedEmails?.length &&
    !tenant.auth.allowedEmailDomains?.length
  ) {
    return true
  }
  return false
}

export function createTenantAuthConfig(
  options: CreateTenantAuthConfigOptions,
): NextAuthConfig {
  const { tenant, trustHost = true } = options
  const providers: NextAuthConfig['providers'] = []

  if (tenant.auth.providers.includes('google')) {
    const clientId = process.env.AUTH_GOOGLE_ID ?? ''
    const clientSecret = process.env.AUTH_GOOGLE_SECRET ?? ''
    if (clientId && clientSecret) {
      providers.push(
        Google({
          clientId,
          clientSecret,
          authorization: { params: { prompt: 'consent' } },
        }),
      )
    }
  }

  if (tenant.auth.providers.includes('github')) {
    const clientId = process.env.AUTH_GITHUB_ID ?? ''
    const clientSecret = process.env.AUTH_GITHUB_SECRET ?? ''
    if (clientId && clientSecret) {
      providers.push(GitHub({ clientId, clientSecret }))
    }
  }

  return {
    trustHost,
    providers,
    callbacks: {
      async signIn({ user }) {
        if (!user.email) return false
        return isEmailAllowed(user.email, tenant)
      },
      async jwt({ token, user, account, profile }) {
        if (user?.email) {
          token.email = user.email
          token.name = user.name
          token.picture = user.image
          token.tenantId = tenant.id
          token.tenantSlug = tenant.slug
        }
        if (account?.provider === 'github' && profile && 'login' in profile) {
          token.githubLogin = String(profile.login)
        }
        return token
      },
      async session({ session, token }) {
        if (session.user && token.email) {
          session.user.email = String(token.email)
          session.user.name = token.name ? String(token.name) : session.user.name
          session.user.image = token.picture
            ? String(token.picture)
            : session.user.image
          ;(session as { tenantId?: string }).tenantId = String(token.tenantId)
          ;(session as { tenantSlug?: string }).tenantSlug = String(
            token.tenantSlug,
          )
          if (token.githubLogin) {
            ;(session as { githubLogin?: string }).githubLogin = String(
              token.githubLogin,
            )
          }
          const sub = token.sub ?? session.user.email
          if (sub && session.user.email) {
            ;(session as { realtimeToken?: string }).realtimeToken =
              await mintRealtimeToken({
                tenantId: tenant.id,
                namespace: tenant.realtime.namespace,
                email: session.user.email,
                name: session.user.name ?? undefined,
                sub,
                role: 'member',
                picture: session.user.image ?? undefined,
                workRepos: tenant.workRepos,
                githubLogin: token.githubLogin
                  ? String(token.githubLogin)
                  : undefined,
              })
          }
        }
        return session
      },
    },
    pages: {
      signIn: '/login',
    },
  }
}