import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import {
  getTenantFromRequest,
  isPlatformEntryHost,
  isPlatformEntryTenantSlug,
  platformEntryTenant,
} from '@bevel/tenant-config'
import {
  isAppleAuthConfigured,
  isGoogleAuthConfigured,
  isMicrosoftAuthConfigured,
  isOtpAuthEnabled,
} from '@bevel/auth'
import { auth } from '@/auth'
import { LoginBevelFrame } from '@/components/login/LoginBevelFrame'
import { LoginPanel } from './LoginPanel'
import {
  NATIVE_COMPLETE_PATH,
  NATIVE_RETURNED_COOKIE,
  isNativeLoginRequest,
} from '@/lib/auth-native'
import { csrfTokenFromCookies } from '@/lib/csrf-cookie'

const ERROR_COPY: Record<string, string> = {
  Configuration:
    'Google sign-in did not finish. Clear session cookies below, then try Continue with Google again.',
  InvalidCheck:
    'Google sign-in could not be verified (the login cookie was missing). Clear session cookies below and try again.',
  AccessDenied:
    'Access denied. Use an email domain authorized for this workspace, or claim a new workspace for your organization.',
  OAuthAccountNotLinked:
    'This email is already linked to another sign-in method. Try the original provider.',
  OAuthCallback:
    'The identity provider returned an error. Confirm the OAuth redirect URI matches this host.',
  OAuthSignin: 'Could not start sign-in. Try again in a moment.',
  MissingCSRF:
    'Sign-in form expired. Hard-refresh this page, then try again.',
  Verification:
    'Sign-in link expired or already used. Start sign-in again from this page.',
  Default: 'Sign-in failed. Try again, or contact your workspace admin.',
  Callback:
    'Sign-in callback failed. If this persists, contact support — server auth logs will show the cause.',
  CallbackRouteError:
    'Signed in, but BEVEL could not finish the session. Reload and try again.',
  OAuthCallbackError:
    'The identity provider returned an error during sign-in. Try again, or use a different account.',
  Apple:
    'Apple sign-in is not configured on this server yet. Use Google.',
  AppleCancelled: 'Apple sign-in was cancelled.',
  Microsoft:
    'Microsoft sign-in is not configured on this server yet. Use Google.',
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
    message?: string
    native?: string
    return?: string
  }>
}) {
  const session = await auth()
  const params = await searchParams
  const nativeReturn = isNativeLoginRequest(params)
  const errorKey = params.error ?? ''
  const errorMessage = params.message
    ? params.message
    : errorKey
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
  const tenant =
    (await getTenantFromRequest()) ??
    (platformEntry ? platformEntryTenant(host || 'bevel.is') : null)
  if (!tenant) {
    redirect('/workspaces')
  }
  const isPlatformTenant = isPlatformEntryTenantSlug(tenant.slug)
  const isPlatform = platformEntry || isPlatformTenant

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
    '/api/auth',
    '/api/auth/signin',
    '/api/auth/callback',
  ])
  const callbackUrl =
    nativeReturn || callbackPathOnly === NATIVE_COMPLETE_PATH
      ? NATIVE_COMPLETE_PATH
      : unsafeCallbacks.has(callbackPathOnly)
        ? '/welcome'
        : rawCallback

  const cookieJar = await cookies()
  const nativeAlreadyReturned =
    cookieJar.get(NATIVE_RETURNED_COOKIE)?.value === '1'
  const csrfToken = csrfTokenFromCookies((name) => cookieJar.get(name)?.value)
  if (session?.user?.email && !errorKey) {
    if (!(nativeReturn && nativeAlreadyReturned)) {
      redirect(callbackUrl)
    }
  }

  const googleOk =
    (tenant.auth.providers.includes('google') ||
      platformEntry ||
      isPlatformTenant) &&
    isGoogleAuthConfigured()

  if (nativeReturn && !googleOk && host !== 'bevel.is' && host !== 'www.bevel.is') {
    redirect(
      `https://bevel.is/login?native=1&callbackUrl=${NATIVE_COMPLETE_PATH}`,
    )
  }
  const appleOk = isAppleAuthConfigured()
  const microsoftOk = isMicrosoftAuthConfigured()
  const otpOk = isOtpAuthEnabled()

  const workspaceLabel = (
    tenant.theme.productName ??
    tenant.name ??
    tenant.slug
  ).replace(/\s+Agents$/i, '')

  const title = isPlatform ? 'Welcome to Bevel' : `Welcome to ${workspaceLabel}`
  const subtitle = isPlatform
    ? 'Choose your work account to get started.'
    : `Sign in with an authorized work account for ${workspaceLabel}.`

  return (
    <div className="flex w-full flex-col items-center">
      <LoginBevelFrame>
        <h1 className="text-center font-display text-[2rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.35rem]">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-[15px] leading-relaxed text-muted">
          {subtitle}
        </p>

        {nativeReturn ? (
          <p className="mt-4 rounded-xl border border-border bg-background/40 px-4 py-3 text-center text-sm leading-relaxed text-muted">
            {nativeAlreadyReturned
              ? 'You can close this tab. Finish in the BEVEL app.'
              : 'After you sign in, this browser will send you back to the BEVEL app. Stay here until that handoff finishes.'}
          </p>
        ) : null}

        {errorMessage ? (
          <div
            role="alert"
            className="mt-5 space-y-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            <p>{errorMessage}</p>
            <p className="text-xs text-danger/80">
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

        <div className="mt-8">
          {nativeAlreadyReturned ? (
            <p className="text-center text-sm text-muted">
              Return to the desktop window. Signing in again here will loop.
            </p>
          ) : (
            <LoginPanel
              callbackUrl={callbackUrl}
              csrfToken={csrfToken}
              googleOk={googleOk}
              appleOk={appleOk}
              microsoftOk={microsoftOk}
              otpOk={otpOk}
            />
          )}
        </div>
      </LoginBevelFrame>

      {isPlatform ? (
        <p className="mt-6 text-center text-xs text-muted">
          New organization?{' '}
          <Link href="/claim" className="font-semibold text-foreground/80 underline-offset-2 hover:underline">
            Claim a workspace
          </Link>
          {' · '}
          <Link href="/download" className="font-semibold text-foreground/80 underline-offset-2 hover:underline">
            Download the app
          </Link>
        </p>
      ) : (
        <p className="mt-6 text-center text-xs text-muted">
          <Link
            href="https://bevel.is"
            className="font-semibold text-foreground/80 underline-offset-2 hover:underline"
          >
            BEVEL platform
          </Link>
        </p>
      )}
    </div>
  )
}
