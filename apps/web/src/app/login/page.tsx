import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
  getTenantFromRequest,
  isPlatformEntryHost,
  isPlatformEntryTenantSlug,
  platformEntryTenant,
} from '@bevel/tenant-config'
import {
  isGitHubAuthConfigured,
  isGoogleAuthConfigured,
  isOtpAuthEnabled,
} from '@bevel/auth'
import { auth } from '@/auth'
import { BevelCutMark } from '@/components/BevelCutMark'
import { BevelMark } from '@/components/BevelMark'
import { GitHubSignInButton, GoogleSignInButton } from './GoogleSignInButton'
import { OtpSignIn } from './OtpSignIn'
import {
  NATIVE_COMPLETE_PATH,
  isNativeLoginRequest,
} from '@/lib/auth-native'

const ERROR_COPY: Record<string, string> = {
  Configuration:
    'Sign-in hit a server configuration error. Confirm Google OAuth redirect URIs include this host’s /api/auth/callback/google, then hard-refresh.',
  AccessDenied:
    'Access denied. Use an email domain authorized for this workspace, or claim a new workspace for your organization.',
  OAuthAccountNotLinked:
    'This email is already linked to another sign-in method. Try the original provider.',
  OAuthCallback:
    'Google returned an error. Confirm the OAuth redirect URI matches this host’s /api/auth/callback/google.',
  OAuthSignin: 'Could not start Google sign-in. Try again in a moment.',
  MissingCSRF:
    'Sign-in form expired. Hard-refresh this page, then try Continue with Google again.',
  Verification:
    'Sign-in link expired or already used. Start Google sign-in again from this page.',
  Default: 'Sign-in failed. Try again, or contact your workspace admin.',
  Callback:
    'Sign-in callback failed after Google. If this persists, contact support — server auth logs will show the cause.',
  CallbackRouteError:
    'Google signed you in, but BEVEL could not finish the session. Reload and try again.',
  OAuthCallbackError:
    'Google returned an error during sign-in. Try again, or use a different Google account.',
  HandoffMissing: 'Session handoff code was missing. Sign in again from this host.',
  HandoffFailed:
    'Could not complete cross-host sign-in. Sign in directly on this workspace host, or try again.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string
    error?: string
    native?: string
    return?: string
  }>
}) {
  const session = await auth()
  const params = await searchParams
  const nativeReturn = isNativeLoginRequest(params)
  const errorKey = params.error ?? ''
  const errorMessage = errorKey
    ? (ERROR_COPY[errorKey] ?? ERROR_COPY.Default)
    : null
  // Surface a clear-session escape when Auth.js reports JWT/session breakage.

  const headerStore = await headers()
  const host = (
    headerStore.get('x-bevel-host') ??
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host') ??
    ''
  )
    .toLowerCase()
    .split(':')[0]
  const platformEntry = isPlatformEntryHost(host)
  // Soft resolve: org hosts use YAML/DB registry; apex uses synthetic platform tenant.
  const tenant =
    (await getTenantFromRequest()) ??
    (platformEntry ? platformEntryTenant(host || 'bevel.is') : null)
  if (!tenant) {
    redirect('/workspaces')
  }
  const isPlatformTenant = isPlatformEntryTenantSlug(tenant.slug)
  const isPlatform = platformEntry || isPlatformTenant

  // Flutter sends native=1. Absolute callback URLs used to be discarded
  // (must start with /), so Auth.js landed on /welcome and never returned
  // to the desktop app.
  const rawCallback =
    nativeReturn
      ? NATIVE_COMPLETE_PATH
      : params.callbackUrl &&
          params.callbackUrl.startsWith('/') &&
          !params.callbackUrl.startsWith('//')
        ? params.callbackUrl
        : '/welcome'
  const callbackPathOnly = rawCallback.split('?')[0] || '/welcome'
  const unsafeCallbacks = new Set([
    '/login',
    '/welcome',
    '/api/auth',
    '/api/auth/signin',
    '/api/auth/callback',
  ])
  const callbackUrl =
    nativeReturn || callbackPathOnly === NATIVE_COMPLETE_PATH
      ? NATIVE_COMPLETE_PATH
      : unsafeCallbacks.has(callbackPathOnly)
        ? '/workspaces'
        : rawCallback

  if (session?.user?.email) {
    redirect(callbackUrl)
  }

  const googleOk =
    (tenant.auth.providers.includes('google') ||
      platformEntry ||
      isPlatformTenant) &&
    isGoogleAuthConfigured()
  const githubOk =
    tenant.auth.providers.includes('github') && isGitHubAuthConfigured()
  const otpOk = isOtpAuthEnabled()

  const workspaceLabel = (
    tenant.theme.productName ??
    tenant.name ??
    tenant.slug
  ).replace(/\s+Agents$/i, '')

  // Org workspaces only: list that tenant’s allowed domains. Never show another
  // customer’s domains (e.g. 2x4m) on the platform entry host.
  const domains =
    !isPlatform &&
    tenant.auth.allowedEmailDomains &&
    tenant.auth.allowedEmailDomains.length > 0
      ? tenant.auth.allowedEmailDomains.map((domain) => ({
          domain,
          label: `@${domain}`,
        }))
      : []

  const explicitEmails =
    !isPlatform &&
    tenant.auth.allowedEmails &&
    tenant.auth.allowedEmails.length > 0
      ? tenant.auth.allowedEmails
      : []

  // Platform: BEVEL cut-mark + wordmark (marketing brand). Never customer logos.
  // Org host: that workspace mark only, fixed square box so SVG never skews.
  const tenantLogo =
    !isPlatform && tenant.theme.logoUrl ? tenant.theme.logoUrl : null

  const title = isPlatform
    ? 'Find your workspace'
    : `Sign in to ${workspaceLabel}`

  const subtitle = isPlatform
    ? 'Sign in with Google or email to open your organization workspace — or claim a new one. Channels for humans and agents.'
    : `Sign in with an authorized account for ${workspaceLabel}. Open channels, agents, and workspace tools.`

  return (
    <div className="w-full rounded-2xl border border-border bg-surface p-8 shadow-sm sm:p-10">
      <div className="mb-6 flex flex-col items-center gap-3">
        {isPlatform ? (
          <>
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-foreground">
              <BevelCutMark className="h-7 w-7 text-foreground" />
            </span>
            <BevelMark size="lg" className="text-foreground" />
          </>
        ) : tenantLogo ? (
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface">
            <Image
              src={tenantLogo}
              alt={workspaceLabel}
              width={56}
              height={56}
              className="size-10 object-contain"
              priority
            />
          </span>
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-foreground">
            <BevelCutMark className="h-7 w-7 text-foreground" />
          </span>
        )}
      </div>

      <h1 className="text-center font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-muted">
        {subtitle}
      </p>
      {nativeReturn ? (
        <p className="mx-auto mt-4 max-w-md rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm leading-relaxed text-muted">
          After Google, this browser will send you back to the BEVEL app.
          Stay here until that handoff finishes.
        </p>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="mt-6 space-y-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p>{errorMessage}</p>
          <p className="text-xs text-red-700">
            Stuck in a redirect loop?{' '}
            <a
              className="font-semibold underline underline-offset-2"
              href="/login?clear=1"
            >
              Clear session cookies and try again
            </a>
            .
          </p>
        </div>
      ) : null}

      <div className="mt-8 space-y-4">
        {googleOk ? (
          <GoogleSignInButton
            callbackUrl={callbackUrl}
            label="Continue with Google"
          />
        ) : (
          <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted">
            Google sign-in is not configured on this server.
          </div>
        )}

        {githubOk ? <GitHubSignInButton callbackUrl={callbackUrl} /> : null}

        {otpOk ? (
          <>
            <div className="relative py-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              <span className="relative z-10 bg-surface px-2">or</span>
              <span
                className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border"
                aria-hidden
              />
            </div>
            <OtpSignIn callbackUrl={callbackUrl} />
          </>
        ) : null}
      </div>

      {isPlatform ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-foreground">
            New organization?
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Claim a BEVEL workspace for your company domain. No customer brands
            are shown here — you only see your workspace after sign-in.
          </p>
          <p className="mt-3">
            <Link
              href="/claim"
              className="text-xs font-semibold text-foreground underline-offset-2 hover:underline"
            >
              Claim workspace
            </Link>
            {' · '}
            <Link
              href="/workspaces"
              className="text-xs font-semibold text-foreground underline-offset-2 hover:underline"
            >
              Browse workspaces
            </Link>
          </p>
        </div>
      ) : domains.length > 0 || explicitEmails.length > 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-foreground">
            Authorized for this workspace
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {domains.map(({ domain, label }) => (
              <li key={domain}>{label}</li>
            ))}
            {explicitEmails.map((email) => (
              <li key={email}>{email}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-6 text-center text-xs text-muted">
        {isPlatform ? (
          <>
            <Link
              href="/download"
              className="font-semibold text-gray-800 underline-offset-2 hover:underline"
            >
              Download app
            </Link>
            {' · '}
            <Link
              href="/about"
              className="font-semibold text-gray-800 underline-offset-2 hover:underline"
            >
              About BEVEL
            </Link>
            {errorKey === 'AccessDenied' ? (
              <>
                {' · '}
                <Link
                  href="/claim"
                  className="font-semibold text-gray-800 underline-offset-2 hover:underline"
                >
                  Claim workspace
                </Link>
              </>
            ) : null}
          </>
        ) : (
          <>
            <Link
              href="https://bevel.is"
              className="font-semibold text-gray-800 underline-offset-2 hover:underline"
            >
              BEVEL platform
            </Link>
            {errorKey === 'AccessDenied' ? (
              <>
                {' · '}
                <Link
                  href="https://bevel.is/claim"
                  className="font-semibold text-gray-800 underline-offset-2 hover:underline"
                >
                  Claim workspace
                </Link>
              </>
            ) : null}
          </>
        )}
      </p>
    </div>
  )
}
