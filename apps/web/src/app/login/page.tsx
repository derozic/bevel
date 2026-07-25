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
import { GitHubSignInButton, GoogleSignInButton } from './GoogleSignInButton'
import { OtpSignIn } from './OtpSignIn'

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
    'Sign-in callback failed. Confirm Google redirect URIs include this host, then try again.',
  HandoffMissing: 'Session handoff code was missing. Sign in again from this host.',
  HandoffFailed:
    'Could not complete cross-host sign-in. Sign in directly on this workspace host, or try again.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  const session = await auth()
  const params = await searchParams
  const errorKey = params.error ?? ''
  const errorMessage = errorKey
    ? (ERROR_COPY[errorKey] ?? ERROR_COPY.Default)
    : null

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

  const callbackUrl =
    params.callbackUrl &&
    params.callbackUrl.startsWith('/') &&
    !params.callbackUrl.startsWith('//')
      ? params.callbackUrl
      : '/welcome'

  // Honor callbackUrl when already signed in (e.g. /login?callbackUrl=/claim).
  if (session?.user) {
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

  const logoSrc =
    !isPlatform && tenant.theme.logoUrl
      ? tenant.theme.logoUrl
      : '/icons/icon-192.png'
  const logoAlt = isPlatform ? 'BEVEL' : workspaceLabel

  const title = isPlatform
    ? 'Find your workspace'
    : `Sign in to ${workspaceLabel}`

  const subtitle = isPlatform
    ? 'Sign in with Google or email to open your organization workspace — or claim a new one. Channels for humans and agents.'
    : `Sign in with an authorized account for ${workspaceLabel}. Open channels, agents, and workspace tools.`

  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 shadow-sm sm:p-10">
      <div className="mb-6 flex justify-center">
        <Image
          src={logoSrc}
          alt={logoAlt}
          width={48}
          height={48}
          className="h-10 w-auto"
          priority
        />
      </div>

      <h1 className="text-center font-display text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-gray-600">
        {subtitle}
      </p>

      {errorMessage ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-8 space-y-4">
        {googleOk ? (
          <GoogleSignInButton
            callbackUrl={callbackUrl}
            label="Continue with Google"
          />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Google sign-in is not configured on this server.
          </div>
        )}

        {githubOk ? <GitHubSignInButton callbackUrl={callbackUrl} /> : null}

        {otpOk ? (
          <>
            <div className="relative py-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
              <span className="relative z-10 bg-white px-2">or</span>
              <span
                className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gray-200"
                aria-hidden
              />
            </div>
            <OtpSignIn callbackUrl={callbackUrl} />
          </>
        ) : null}
      </div>

      {isPlatform ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-900">
            New organization?
          </p>
          <p className="mt-2 text-xs leading-relaxed text-gray-600">
            Claim a BEVEL workspace for your company domain. No customer brands
            are shown here — you only see your workspace after sign-in.
          </p>
          <p className="mt-3">
            <Link
              href="/claim"
              className="text-xs font-semibold text-gray-900 underline-offset-2 hover:underline"
            >
              Claim workspace
            </Link>
            {' · '}
            <Link
              href="/workspaces"
              className="text-xs font-semibold text-gray-900 underline-offset-2 hover:underline"
            >
              Browse workspaces
            </Link>
          </p>
        </div>
      ) : domains.length > 0 || explicitEmails.length > 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-900">
            Authorized for this workspace
          </p>
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {domains.map(({ domain, label }) => (
              <li key={domain}>{label}</li>
            ))}
            {explicitEmails.map((email) => (
              <li key={email}>{email}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-6 text-center text-xs text-gray-500">
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
