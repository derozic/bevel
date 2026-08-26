'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@bevel/ui'

/**
 * Google / GitHub sign-in.
 *
 * Native form POST to Auth.js (no Next server actions, no client signIn()).
 */
export function GoogleSignInButton({
  callbackUrl = '/welcome',
  label = 'Continue with Google Workspace',
  csrfToken,
}: {
  callbackUrl?: string
  label?: string
  csrfToken?: string | null
}) {
  return (
    <OAuthSignInButton
      provider="google"
      callbackUrl={callbackUrl}
      label={label}
      variant="primary"
      initialCsrf={csrfToken}
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
      variant="outline"
      initialCsrf={csrfToken}
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
  variant,
  initialCsrf,
}: {
  provider: 'google' | 'github'
  callbackUrl: string
  label: string
  variant: 'primary' | 'outline'
  initialCsrf?: string | null
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
    // SessionProvider GET /api/auth/session also mints the CSRF cookie.
    // Fetch csrf only after that settles, or the form token and cookie diverge
    // (MissingCSRF / "Could not prepare sign-in").
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

  // Same primitive as HomePage: accent fill, never ink `--color-cta`.
  const btnClass =
    variant === 'primary'
      ? 'bevel-auth-primary h-12 w-full rounded-full'
      : 'h-12 w-full rounded-full'

  // Native form POST to Auth.js. Do not preventDefault + getCsrfToken() on
  // submit — that second fetch is what surfaces "Could not prepare sign-in"
  // when HMR/Caddy interrupts /api/auth/csrf, even though the hidden field
  // already has a valid token.
  return (
    <div className="space-y-2">
      <form method="POST" action={`/api/auth/signin/${provider}`} suppressHydrationWarning>
        {csrfToken ? (
          <input type="hidden" name="csrfToken" value={csrfToken} />
        ) : null}
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Button
          type="submit"
          size="lg"
          variant={variant === 'primary' ? 'default' : 'outline'}
          disabled={!csrfToken}
          className={btnClass}
          suppressHydrationWarning
        >
          {provider === 'google' ? <GoogleGlyph /> : null}
          {label}
        </Button>
      </form>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        opacity=".95"
      />
      <path
        fill="currentColor"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        opacity=".8"
      />
      <path
        fill="currentColor"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        opacity=".65"
      />
      <path
        fill="currentColor"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        opacity=".85"
      />
    </svg>
  )
}
