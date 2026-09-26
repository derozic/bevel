'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { writeLastUsedMethod, type LoginMethodCta } from './login-methods'

/**
 * Google / Microsoft / GitHub sign-in.
 *
 * Native form POST to Auth.js (no Next server actions, no client signIn()).
 */
export function GoogleSignInButton({
  callbackUrl = '/welcome',
  label = 'Sign in with Google',
  csrfToken,
  lastUsed,
  className,
}: {
  callbackUrl?: string
  label?: string
  csrfToken?: string | null
  lastUsed?: boolean
  className?: string
}) {
  return (
    <OAuthSignInButton
      provider="google"
      callbackUrl={callbackUrl}
      label={label}
      initialCsrf={csrfToken}
      dataCta="google"
      lastUsed={lastUsed}
      glyph={<GoogleGlyph />}
      className={className}
    />
  )
}

export function MicrosoftSignInButton({
  callbackUrl = '/welcome',
  label = 'Sign in with Microsoft',
  csrfToken,
  lastUsed,
  configured,
  onUnconfigured,
}: {
  callbackUrl?: string
  label?: string
  csrfToken?: string | null
  lastUsed?: boolean
  configured: boolean
  onUnconfigured: () => void
}) {
  if (!configured) {
    return (
      <div className="relative">
        {lastUsed ? <LastUsedBadge /> : null}
        <button
          type="button"
          className="login-provider"
          data-cta="microsoft"
          onClick={onUnconfigured}
        >
          <MicrosoftGlyph />
          {label}
        </button>
      </div>
    )
  }
  return (
    <OAuthSignInButton
      provider="microsoft-entra-id"
      callbackUrl={callbackUrl}
      label={label}
      initialCsrf={csrfToken}
      dataCta="microsoft"
      lastUsed={lastUsed}
      glyph={<MicrosoftGlyph />}
    />
  )
}

export function GitHubSignInButton({
  callbackUrl = '/welcome',
  label = 'Continue with GitHub',
  csrfToken,
}: {
  callbackUrl?: string
  label?: string
  csrfToken?: string | null
}) {
  return (
    <OAuthSignInButton
      provider="github"
      callbackUrl={callbackUrl}
      label={label}
      initialCsrf={csrfToken}
      className="h-12 w-full rounded-full"
      glyph={null}
    />
  )
}

let cachedCsrf: string | null = null
let csrfInflight: Promise<string | null> | null = null

function loadCsrfToken(): Promise<string | null> {
  if (cachedCsrf) return Promise.resolve(cachedCsrf)
  if (!csrfInflight) {
    csrfInflight = fetch('/api/auth/session', {
      credentials: 'include',
      cache: 'no-store',
    })
      .catch(() => null)
      .then(() =>
        fetch('/api/auth/csrf', {
          credentials: 'include',
          cache: 'no-store',
        }),
      )
      .then(async (res) => {
        if (!res.ok) return null
        const data = (await res.json()) as { csrfToken?: string }
        const token = data.csrfToken ?? null
        if (token) cachedCsrf = token
        return token
      })
      .catch(() => null)
      .finally(() => {
        csrfInflight = null
      })
  }
  return csrfInflight
}

function OAuthSignInButton({
  provider,
  callbackUrl,
  label,
  initialCsrf,
  dataCta,
  lastUsed,
  glyph,
  className,
}: {
  provider: 'google' | 'github' | 'microsoft-entra-id'
  callbackUrl: string
  label: string
  initialCsrf?: string | null
  dataCta?: LoginMethodCta
  lastUsed?: boolean
  glyph: ReactNode
  className?: string
}) {
  const { status } = useSession()
  const [csrfToken, setCsrfToken] = useState<string | null>(() => {
    if (initialCsrf) {
      cachedCsrf = initialCsrf
      return initialCsrf
    }
    return cachedCsrf
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading' || csrfToken) return
    let cancelled = false
    void loadCsrfToken()
      .then((token) => {
        if (cancelled) return
        setCsrfToken(token)
        if (!token) {
          setError('Could not prepare sign-in. Reload and try again.')
        }
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not prepare sign-in. Reload and try again.')
      })
    return () => {
      cancelled = true
    }
  }, [status, csrfToken])

  return (
    <div className="relative space-y-2">
      {lastUsed ? <LastUsedBadge /> : null}
      <form
        method="POST"
        action={`/api/auth/signin/${provider}`}
        suppressHydrationWarning
        onSubmit={() => {
          if (dataCta) writeLastUsedMethod(dataCta)
        }}
      >
        {csrfToken ? (
          <input type="hidden" name="csrfToken" value={csrfToken} />
        ) : null}
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <button
          type="submit"
          disabled={!csrfToken}
          className={className ?? 'login-provider'}
          data-cta={dataCta}
          suppressHydrationWarning
        >
          {glyph}
          {label}
        </button>
      </form>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function LastUsedBadge() {
  return <span className="login-last-used">Last used</span>
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function MicrosoftGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect fill="#F25022" x="1" y="1" width="6.5" height="6.5" />
      <rect fill="#7FBA00" x="8.5" y="1" width="6.5" height="6.5" />
      <rect fill="#00A4EF" x="1" y="8.5" width="6.5" height="6.5" />
      <rect fill="#FFB900" x="8.5" y="8.5" width="6.5" height="6.5" />
    </svg>
  )
}
