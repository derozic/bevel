import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
  isPlatformEntryHost,
  requireTenantFromRequest,
} from '@bevel/tenant-config'
import {
  isGitHubAuthConfigured,
  isGoogleAuthConfigured,
  isOtpAuthEnabled,
} from '@bevel/auth'
import { auth } from '@/auth'
import { GitHubSignInButton, GoogleSignInButton } from './GoogleSignInButton'
import { OtpSignIn } from './OtpSignIn'

/** Match 2x4m platform authorized-domains. */
const PLATFORM_DOMAINS = [
  { domain: '2x4m.cc', label: '@2x4m.cc' },
  { domain: '2x4m.systems', label: '@2x4m.systems' },
  { domain: 'derozic.com', label: '@derozic.com' },
]

const PLATFORM_EXPLICIT_EMAILS = [
  'twobyform@gmail.com',
  'sderozic@gmail.com',
]

const ERROR_COPY: Record<string, string> = {
  Configuration:
    'Sign-in hit a server configuration error. Confirm Google OAuth redirect URIs include https://bevel.2x4m.cc/api/auth/callback/google, then hard-refresh.',
  AccessDenied:
    'Access denied. Use an authorized 2x4m workspace email domain, or claim a workspace for your organization.',
  OAuthAccountNotLinked:
    'This email is already linked to another sign-in method. Try the original provider.',
  OAuthCallback:
    'Google returned an error. Confirm the OAuth redirect URI matches https://bevel.2x4m.cc/api/auth/callback/google.',
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
  const tenant = await requireTenantFromRequest()
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

  const callbackUrl =
    params.callbackUrl &&
    params.callbackUrl.startsWith('/') &&
    !params.callbackUrl.startsWith('//')
      ? params.callbackUrl
      : '/welcome'

  // Honor callbackUrl when already signed in (e.g. /login?callbackUrl=/claim).
  // Previously always forced /welcome, which broke claim and other deep links.
  if (session?.user) {
    redirect(callbackUrl)
  }

  const googleOk =
    (tenant.auth.providers.includes('google') || platformEntry) &&
    isGoogleAuthConfigured()
  const githubOk =
    tenant.auth.providers.includes('github') && isGitHubAuthConfigured()
  const otpOk = isOtpAuthEnabled()

  const workspaceLabel = (
    tenant.theme.productName ??
    tenant.name ??
    tenant.slug
  ).replace(/\s+Agents$/i, '')

  const domains =
    tenant.auth.allowedEmailDomains && tenant.auth.allowedEmailDomains.length > 0
      ? tenant.auth.allowedEmailDomains.map((domain) => {
          const known = PLATFORM_DOMAINS.find((d) => d.domain === domain)
          return known ?? { domain, label: `@${domain}` }
        })
      : PLATFORM_DOMAINS

  const explicitEmails =
    tenant.auth.allowedEmails && tenant.auth.allowedEmails.length > 0
      ? tenant.auth.allowedEmails
      : PLATFORM_EXPLICIT_EMAILS

  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 shadow-sm sm:p-10">
      <div className="mb-6 flex justify-center">
        <Image
          src="/brand/2x4m/logo.svg"
          alt="2x4m"
          width={48}
          height={48}
          className="h-10 w-auto"
          priority
        />
      </div>

      <h1 className="text-center font-display text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
        {platformEntry
          ? 'Find your 2x4m workspace'
          : `Sign in to ${workspaceLabel}`}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-gray-600">
        Same Google Workspace sign-in as the rest of 2x4m.cc. Open channels,
        agents, and workspace tools for authorized domains.
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

      <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-900">
          Authorized access
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

      <p className="mt-6 text-center text-xs text-gray-500">
        <Link
          href="https://2x4m.cc/auth/signin"
          className="font-semibold text-gray-800 underline-offset-2 hover:underline"
        >
          Platform sign-in
        </Link>
        {' · '}
        <Link
          href="https://2x4m.cc"
          className="font-semibold text-gray-800 underline-offset-2 hover:underline"
        >
          Platform home
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
      </p>
    </div>
  )
}
