import Link from 'next/link'
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
import { BevelMark } from '@/components/BevelMark'
import { auth } from '@/auth'
import { BEVEL_NAME, BEVEL_TRADEMARK_NOTICE } from '@/lib/bevel'
import { GitHubSignInButton, GoogleSignInButton } from './GoogleSignInButton'
import { OtpSignIn } from './OtpSignIn'

const ERROR_COPY: Record<string, string> = {
  Configuration:
    'Sign-in hit a server configuration error. Usually the OAuth callback host does not match AUTH_URL, or PKCE cookies could not hop to the platform callback. Hard-refresh, clear site cookies for *.lvh.me, and try again.',
  AccessDenied: `That Google Workspace account is not mapped to a ${BEVEL_NAME} organization yet. Claim a workspace to secure your namespace.`,
  OAuthAccountNotLinked:
    'This email is already linked to another sign-in method. Try the original provider.',
  OAuthCallback:
    'Google returned an error. Check the OAuth redirect URI includes the platform host (bevel.lvh.me).',
  OAuthSignin: 'Could not start Google sign-in. Try again in a moment.',
  MissingCSRF:
    'Sign-in form expired (CSRF). Hard-refresh this page, then try Continue with Google again. If it keeps failing, clear cookies for this site and *.lvh.me.',
  Verification:
    'Sign-in link expired or already used. Start Google sign-in again from this page.',
  Default: 'Sign-in failed. Try again, or contact your workspace admin.',
  Callback:
    'Sign-in callback failed. Confirm the Google redirect URI matches AUTH_URL (platform host).',
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

  // Already signed in → org discovery
  if (session?.user) {
    redirect('/welcome')
  }

  const googleOk =
    (tenant.auth.providers.includes('google') || platformEntry) &&
    isGoogleAuthConfigured()
  const githubOk =
    tenant.auth.providers.includes('github') && isGitHubAuthConfigured()
  const otpOk = isOtpAuthEnabled()

  // Prefer explicit callback, else always welcome (domain → org router)
  const callbackUrl =
    params.callbackUrl &&
    params.callbackUrl.startsWith('/') &&
    !params.callbackUrl.startsWith('//')
      ? params.callbackUrl
      : '/welcome'

  const workspaceLabel = (
    tenant.theme.productName ??
    tenant.name ??
    tenant.slug
  ).replace(/\s+Agents$/i, '')

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-6">
        <Link href="/" className="inline-flex items-center gap-3 text-foreground">
          <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
            <span className="text-xs font-semibold tracking-[0.2em] text-accent">
              B
            </span>
          </span>
          <BevelMark size="md" />
        </Link>

        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {platformEntry
              ? 'Find your workspace'
              : `Sign in to ${workspaceLabel}`}
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            {platformEntry ? (
              <>
                Sign in with Google Workspace, or a one-time code by email or
                mobile. We route you to your organization&apos;s {BEVEL_NAME}.
              </>
            ) : (
              <>
                Use Google, email code, or mobile code to open channels in{' '}
                {workspaceLabel}.
              </>
            )}
          </p>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-foreground"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="space-y-3 rounded-2xl border border-border bg-surface/60 p-5">
          {googleOk ? (
            <GoogleSignInButton callbackUrl={callbackUrl} />
          ) : (
            <div className="rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-muted">
              Google sign-in is not configured on this server.
            </div>
          )}

          {githubOk ? <GitHubSignInButton callbackUrl={callbackUrl} /> : null}

          {otpOk ? (
            <>
              <div className="relative py-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                <span className="relative z-10 bg-surface/60 px-2">or</span>
                <span
                  className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border"
                  aria-hidden
                />
              </div>
              <OtpSignIn callbackUrl={callbackUrl} />
            </>
          ) : null}
        </div>

        <ul className="space-y-2 text-sm text-muted">
          <li className="flex gap-2">
            <span className="text-accent">01</span>
            Google, email OTP, or mobile OTP verifies who you are
          </li>
          <li className="flex gap-2">
            <span className="text-accent">02</span>
            We map your email domain (or host for phone) to your organization
          </li>
          <li className="flex gap-2">
            <span className="text-accent">03</span>
            You open that org&apos;s channels and historical chats
          </li>
        </ul>

        <p className="text-sm text-muted">
          New organization?{' '}
          <Link href="/claim" className="font-medium text-accent hover:underline">
            Claim a workspace
          </Link>{' '}
          to secure your namespace.
        </p>

        {errorKey === 'AccessDenied' ? (
          <Link
            href="/claim"
            className="block rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-center text-sm font-semibold text-foreground transition hover:bg-accent/15"
          >
            Claim workspace for your domain
          </Link>
        ) : null}

        <p className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
          {BEVEL_TRADEMARK_NOTICE}
        </p>
      </div>
    </main>
  )
}
