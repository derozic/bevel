import './types'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import type { NextAuthConfig } from 'next-auth'
import type { Tenant } from '@bevel/schema'
import {
  isPlatformEntryHost,
  listTenants,
  lookupTenantBySlug,
  publicTenantUrl,
  resolveHomeTenantForEmail,
  resolveWorkspacesForEmail,
} from '@bevel/tenant-config'
import { mintRealtimeToken, resolveAuthSecret } from './tokens'

export interface CreateTenantAuthConfigOptions {
  /** Tenant resolved from Host (shell / org surface). */
  tenant: Tenant
  /** Request host (for platform-entry detection). */
  host?: string
  trustHost?: boolean
}

function emailAllowedOnTenant(email: string, tenant: Tenant): boolean {
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

/** Platform login: allow if any org tenant accepts this Workspace email. */
function emailAllowedOnPlatform(email: string): boolean {
  const { tenants } = resolveWorkspacesForEmail(email)
  if (tenants.length > 0) return true
  // Exact email allowlist on any tenant
  const normalized = email.toLowerCase()
  return listTenants().some((t) =>
    t.auth.allowedEmails?.some((e) => e.toLowerCase() === normalized),
  )
}

function useSecureCookies(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.NEXTAUTH_URL?.startsWith('https') === true ||
    process.env.AUTH_URL?.startsWith('https') === true
  )
}

/** Cookie domain so platform login can hop to org hosts (e.g. .lvh.me). */
function cookieDomain(): string | undefined {
  return process.env.AUTH_COOKIE_DOMAIN || process.env.NEXTAUTH_COOKIE_DOMAIN || undefined
}

export function isGoogleAuthConfigured(): boolean {
  const id = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID
  const secret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET
  return Boolean(id && secret)
}

export function isGitHubAuthConfigured(): boolean {
  const id = process.env.AUTH_GITHUB_ID || process.env.GITHUB_CLIENT_ID
  const secret = process.env.AUTH_GITHUB_SECRET || process.env.GITHUB_CLIENT_SECRET
  return Boolean(id && secret)
}

export function createTenantAuthConfig(
  options: CreateTenantAuthConfigOptions,
): NextAuthConfig {
  const { tenant, host, trustHost = true } = options
  const platformEntry = host ? isPlatformEntryHost(host) : false
  const providers: NextAuthConfig['providers'] = []
  const secure = useSecureCookies()
  const domain = cookieDomain()

  if (
    (tenant.auth.providers.includes('google') || platformEntry) &&
    isGoogleAuthConfigured()
  ) {
    const clientId =
      process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || ''
    const clientSecret =
      process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || ''

    const googleParams: Record<string, string> = {
      scope: 'openid email profile',
      prompt: 'select_account',
      access_type: 'online',
      response_type: 'code',
    }
    // Platform: don't force a single Workspace hd — any org domain may sign in.
    // Org host: hint that tenant's domain when unique.
    if (!platformEntry) {
      const hd = process.env.AUTH_GOOGLE_HD
      if (hd) googleParams.hd = hd
      else if (tenant.auth.allowedEmailDomains?.length === 1) {
        googleParams.hd = tenant.auth.allowedEmailDomains[0]!
      }
    }

    providers.push(
      Google({
        clientId,
        clientSecret,
        allowDangerousEmailAccountLinking: true,
        authorization: { params: googleParams },
      }),
    )
  }

  if (tenant.auth.providers.includes('github') && isGitHubAuthConfigured()) {
    const clientId =
      process.env.AUTH_GITHUB_ID || process.env.GITHUB_CLIENT_ID || ''
    const clientSecret =
      process.env.AUTH_GITHUB_SECRET || process.env.GITHUB_CLIENT_SECRET || ''
    providers.push(
      GitHub({
        clientId,
        clientSecret,
        authorization: {
          params: { scope: 'read:user user:email' },
        },
      }),
    )
  }

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure,
    ...(domain ? { domain } : {}),
  }

  return {
    secret: resolveAuthSecret(),
    trustHost:
      trustHost ||
      process.env.AUTH_TRUST_HOST === 'true' ||
      process.env.AUTH_TRUST_HOST === '1',
    providers,
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60,
    },
    cookies: {
      sessionToken: {
        name: secure
          ? '__Secure-authjs.session-token'
          : 'authjs.session-token',
        options: cookieOptions,
      },
    },
    callbacks: {
      async signIn({ user }) {
        if (!user.email) return false
        if (platformEntry) return emailAllowedOnPlatform(user.email)
        return emailAllowedOnTenant(user.email, tenant)
      },
      async jwt({ token, user, account, profile, trigger }) {
        const email = (user?.email || token.email) as string | undefined
        if (email) {
          token.email = email
          if (user?.name) token.name = user.name
          if (user?.image) token.picture = user.image

          // Slack-like: resolve organization from Workspace email on platform entry
          // (and re-resolve when session updates).
          if (platformEntry || trigger === 'signIn' || !token.tenantSlug) {
            const home = resolveHomeTenantForEmail(email)
            const { tenants } = resolveWorkspacesForEmail(email)
            if (home) {
              token.tenantId = home.id
              token.tenantSlug = home.slug
              token.tenantHost = home.host
              token.realtimeNamespace = home.realtime.namespace
              token.needsWorkspacePick = false
            } else if (tenants.length > 1) {
              // Multiple orgs — picker
              token.tenantId = tenant.id
              token.tenantSlug = tenant.slug
              token.tenantHost = tenant.host
              token.realtimeNamespace = tenant.realtime.namespace
              token.needsWorkspacePick = true
              token.workspaceCandidates = tenants.map((t) => t.slug).join(',')
            } else if (!platformEntry) {
              token.tenantId = tenant.id
              token.tenantSlug = tenant.slug
              token.tenantHost = tenant.host
              token.realtimeNamespace = tenant.realtime.namespace
              token.needsWorkspacePick = false
            }
          }
        }

        // Explicit workspace switch from picker
        if (trigger === 'update' && token.workspaceSwitchSlug) {
          const next = lookupTenantBySlug(String(token.workspaceSwitchSlug))
          if (next && email && emailAllowedOnTenant(email, next)) {
            token.tenantId = next.id
            token.tenantSlug = next.slug
            token.tenantHost = next.host
            token.realtimeNamespace = next.realtime.namespace
            token.needsWorkspacePick = false
          }
          delete token.workspaceSwitchSlug
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

          const slug = String(token.tenantSlug ?? tenant.slug)
          const active = lookupTenantBySlug(slug) ?? tenant

          session.tenantId = active.id
          session.tenantSlug = active.slug
          session.tenantHost = active.host
          session.realtimeNamespace = active.realtime.namespace
          session.needsWorkspacePick = Boolean(token.needsWorkspacePick)
          if (token.workspaceCandidates) {
            session.workspaceCandidates = String(token.workspaceCandidates)
              .split(',')
              .filter(Boolean)
          }
          if (token.githubLogin) {
            session.githubLogin = String(token.githubLogin)
          }

          const sub = token.sub ?? session.user.email
          if (sub && session.user.email) {
            // History + channels are namespaced by org tenant — not the entry host.
            session.realtimeToken = await mintRealtimeToken({
              tenantId: active.id,
              namespace: active.realtime.namespace,
              email: session.user.email,
              name: session.user.name ?? undefined,
              sub,
              role: 'member',
              picture: session.user.image ?? undefined,
              workRepos: active.workRepos,
              githubLogin: token.githubLogin
                ? String(token.githubLogin)
                : undefined,
            })
          }
        }
        return session
      },
      async redirect({ url, baseUrl }) {
        // Prefer org home after platform login (set via signIn redirectTo or absolute)
        if (url.startsWith('/')) return `${baseUrl}${url}`
        try {
          if (new URL(url).origin === baseUrl) return url
          // Allow cross-subdomain hops to org BEVEL (shared cookie domain)
          const u = new URL(url)
          if (u.hostname.endsWith('.lvh.me') || u.hostname.endsWith('.bevel.com')) {
            return url
          }
        } catch {
          /* ignore */
        }
        return `${baseUrl}/bevel`
      },
    },
    pages: {
      signIn: '/login',
      error: '/login',
    },
  }
}

/** Build post-login path for a resolved home tenant. */
export function homePathForTenant(tenant: Tenant, platformHost?: string): string {
  const entry = platformHost && isPlatformEntryHost(platformHost)
  if (entry && tenant.host !== platformHost?.toLowerCase().split(':')[0]) {
    return publicTenantUrl(tenant, '/bevel')
  }
  return '/bevel'
}
