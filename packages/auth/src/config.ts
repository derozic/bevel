import './types'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import Credentials from 'next-auth/providers/credentials'
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
import {
  isPhoneSyntheticEmail,
  phoneToSyntheticEmail,
  verifyOtpCode,
  type OtpChannel,
} from './otp'

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

/**
 * Closed membership: tenant declares email/domain allowlists.
 * Pure phone OTP cannot prove membership on those orgs (no phone allowlist yet).
 */
export function tenantHasClosedMembership(tenant: Tenant): boolean {
  return Boolean(
    tenant.auth.allowedEmails?.length ||
      tenant.auth.allowedEmailDomains?.length,
  )
}

/** Phone OTP is only for open workspaces (no email/domain allowlist). */
export function phoneOtpAllowedOnTenant(tenant: Tenant): boolean {
  return !tenantHasClosedMembership(tenant)
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

/**
 * Auth.js cookies for multi-host OAuth.
 *
 * Local multi-tenant flow pins OAuth callbacks to AUTH_URL (platform host) while
 * users often start sign-in on an org host (e.g. bevel.2x4m.lvh.me).
 *
 * Split strategy (important):
 * - **CSRF is host-only** (`__Host-` when secure). Auth.js only validates CSRF on
 *   the sign-in POST (same host as the form). Putting Domain=.lvh.me on CSRF caused
 *   MissingCSRF in browsers (cookie not paired with the form body) and showed up as
 *   a generic "Sign-in failed" on /login?error=MissingCSRF.
 * - **PKCE / state / session / callback-url share AUTH_COOKIE_DOMAIN** so the Google
 *   callback on the platform host can complete the dance started on an org host, and
 *   the session can hop to the org host after /welcome.
 */
function buildAuthCookies(secure: boolean, domain?: string): NextAuthConfig['cookies'] {
  const hostOnly = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure,
  }
  const shared = {
    ...hostOnly,
    ...(domain ? { domain } : {}),
  }
  const shortLived = { ...shared, maxAge: 60 * 15 }
  const securePrefix = secure ? '__Secure-' : ''
  // CSRF stays host-only — use Auth.js default __Host- name when secure.
  const csrfName = `${secure ? '__Host-' : ''}authjs.csrf-token`

  return {
    sessionToken: {
      name: `${securePrefix}authjs.session-token`,
      options: shared,
    },
    callbackUrl: {
      name: `${securePrefix}authjs.callback-url`,
      options: shared,
    },
    csrfToken: {
      name: csrfName,
      options: hostOnly,
    },
    pkceCodeVerifier: {
      name: `${securePrefix}authjs.pkce.code_verifier`,
      options: shortLived,
    },
    state: {
      name: `${securePrefix}authjs.state`,
      options: shortLived,
    },
    nonce: {
      name: `${securePrefix}authjs.nonce`,
      options: shared,
    },
  }
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

/** OTP (email + SMS) is always available; delivery needs SMTP and/or Twilio. */
export function isOtpAuthEnabled(): boolean {
  const flag = process.env.AUTH_OTP_ENABLED
  if (flag === '0' || flag === 'false') return false
  return true
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

  // GitHub is available for primary sign-in (mode=github) OR account linking
  // for work mode (require_github_for_work) even when primary auth is Google.
  if (isGitHubAuthConfigured()) {
    const clientId =
      process.env.AUTH_GITHUB_ID || process.env.GITHUB_CLIENT_ID || ''
    const clientSecret =
      process.env.AUTH_GITHUB_SECRET || process.env.GITHUB_CLIENT_SECRET || ''
    // repo scope: collaborator checks, issues, work-mode write access
    const scope =
      process.env.AUTH_GITHUB_SCOPES || 'read:user user:email repo'
    providers.push(
      GitHub({
        clientId,
        clientSecret,
        allowDangerousEmailAccountLinking: true,
        authorization: {
          params: { scope },
        },
      }),
    )
  }

  // Email + SMS OTP (Credentials). Codes issued via /api/auth/otp/send.
  if (isOtpAuthEnabled()) {
    providers.push(
      Credentials({
        id: 'otp',
        name: 'OTP',
        credentials: {
          email: { label: 'Email', type: 'email' },
          phone: { label: 'Phone', type: 'tel' },
          otp: { label: 'Code', type: 'text' },
          channel: { label: 'Channel', type: 'text' },
        },
        authorize: async (credentials) => {
          const channelRaw =
            typeof credentials?.channel === 'string'
              ? credentials.channel
              : credentials?.phone
                ? 'sms'
                : 'email'
          const channel = (
            channelRaw === 'sms' ? 'sms' : 'email'
          ) as OtpChannel
          const email =
            typeof credentials?.email === 'string'
              ? credentials.email.trim().toLowerCase()
              : undefined
          const phone =
            typeof credentials?.phone === 'string'
              ? credentials.phone.trim()
              : undefined
          const otp =
            typeof credentials?.otp === 'string' ? credentials.otp.trim() : ''
          const destination = channel === 'sms' ? phone : email
          if (!otp || !destination) return null

          const result = verifyOtpCode(channel, destination, otp)
          if (!result.ok) return null

          if (channel === 'email') {
            const resolved = result.destination
            if (platformEntry) {
              if (!emailAllowedOnPlatform(resolved)) return null
            } else if (!emailAllowedOnTenant(resolved, tenant)) {
              return null
            }
            return {
              id: resolved,
              email: resolved,
              name: resolved.split('@')[0] || resolved,
            }
          }

          // SMS: number possession only proves identity on *open* workspaces.
          // Closed orgs (allowed_domains / allowed_emails) require Google/email.
          if (tenantHasClosedMembership(tenant)) {
            return null
          }
          const synthetic = phoneToSyntheticEmail(result.destination)
          return {
            id: synthetic,
            email: synthetic,
            name: result.destination,
          }
        },
      }),
    )
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
    cookies: buildAuthCookies(secure, domain),
    callbacks: {
      async signIn({ user, account }) {
        if (!user.email) return false
        // Phone OTP: open workspaces only (closed orgs use Google/email allowlists).
        if (
          account?.provider === 'otp' &&
          isPhoneSyntheticEmail(user.email)
        ) {
          return phoneOtpAllowedOnTenant(tenant)
        }
        if (platformEntry) return emailAllowedOnPlatform(user.email)
        return emailAllowedOnTenant(user.email, tenant)
      },
      async jwt({ token, user, account, profile, trigger }) {
        const email = (user?.email || token.email) as string | undefined
        if (email) {
          token.email = email
          if (user?.name) token.name = user.name
          if (user?.image) token.picture = user.image

          // Phone OTP → bind to the host tenant (no email domain map).
          if (isPhoneSyntheticEmail(email)) {
            if (platformEntry || trigger === 'signIn' || !token.tenantSlug) {
              token.tenantId = tenant.id
              token.tenantSlug = tenant.slug
              token.tenantHost = tenant.host
              token.realtimeNamespace = tenant.realtime.namespace
              token.needsWorkspacePick = false
            }
          } else if (
            platformEntry ||
            trigger === 'signIn' ||
            !token.tenantSlug
          ) {
            // Resolve organization from Workspace email on platform entry
            // (and re-resolve when session updates).
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

        // Link or sign-in with GitHub → work mode credentials on the JWT
        if (account?.provider === 'github') {
          if (profile && 'login' in profile) {
            token.githubLogin = String(
              (profile as { login?: string }).login || '',
            )
          }
          if (account.access_token) {
            token.githubAccessToken = String(account.access_token)
          }
          // Linked with repo scope → eligible for work mode (repo checks refine later)
          token.repoWrite = true
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

          // Work mode: GitHub linked + tenant work_mode feature
          const githubLinked = Boolean(token.githubLogin && token.repoWrite)
          const workModeOn = active.features.workMode !== false
          const requireGh = active.auth.requireGitHubForWork
          session.canPutOnWork =
            workModeOn &&
            (requireGh ? githubLinked : githubLinked || !requireGh) &&
            Boolean(token.repoWrite)

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
              repoWrite: Boolean(session.canPutOnWork),
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
