'use client'

import { useEffect, useState } from 'react'
import { getCsrfToken, signIn } from 'next-auth/react'

/**
 * Google / GitHub sign-in.
 *
 * Primary path: native form POST to Auth.js (no Next server actions).
 * That avoids "Failed to fetch" / fetchServerAction failures when the
 * RSC action hash goes stale under HMR or host rewrites.
 *
 * Fallback: client signIn() if CSRF is unavailable.
 */
export function GoogleSignInButton({
  callbackUrl = '/welcome',
  label = 'Continue with Google Workspace',
}: {
  callbackUrl?: string
  label?: string
}) {
  return (
    <OAuthSignInButton
      provider="google"
      callbackUrl={callbackUrl}
      label={label}
      variant="primary"
    />
  )
}

export function GitHubSignInButton({
  callbackUrl = '/welcome',
  label = 'Continue with GitHub',
}: {
  callbackUrl?: string
  label?: string
}) {
  return (
    <OAuthSignInButton
      provider="github"
      callbackUrl={callbackUrl}
      label={label}
      variant="outline"
    />
  )
}

function OAuthSignInButton({
  provider,
  callbackUrl,
  label,
  variant,
}: {
  provider: 'google' | 'github'
  callbackUrl: string
  label: string
  variant: 'primary' | 'outline'
}) {
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getCsrfToken()
      .then((token) => {
        if (!cancelled) setCsrfToken(token ?? null)
      })
      .catch(() => {
        if (!cancelled) setCsrfToken(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const baseClass =
    'inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60'
  const variantClass =
    variant === 'primary'
      ? 'bg-accent text-white hover:opacity-90'
      : 'border border-border bg-transparent text-foreground hover:bg-white/5'

  // Preferred: plain form POST (full navigation → Google). Refresh CSRF on submit
  // so a long-open tab cannot post a stale token after a cookie rotate.
  if (csrfToken) {
    return (
      <div className="space-y-2">
        <form
          method="POST"
          action={`/api/auth/signin/${provider}`}
          onSubmit={(event) => {
            if (pending) {
              event.preventDefault()
              return
            }
            setPending(true)
            setError(null)
            // Re-fetch CSRF immediately before navigate when possible.
            // If the form already has a valid token+cookie pair, submit proceeds.
            const form = event.currentTarget
            const input = form.elements.namedItem('csrfToken') as HTMLInputElement | null
            event.preventDefault()
            void getCsrfToken()
              .then((token) => {
                if (!token) {
                  setPending(false)
                  setError('Could not prepare sign-in. Reload and try again.')
                  return
                }
                if (input) input.value = token
                setCsrfToken(token)
                form.submit()
              })
              .catch(() => {
                setPending(false)
                setError('Could not prepare sign-in. Reload and try again.')
              })
          }}
        >
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <button
            type="submit"
            disabled={pending}
            className={`${baseClass} ${variantClass}`}
          >
            {provider === 'google' ? <GoogleGlyph /> : null}
            {pending ? 'Redirecting…' : label}
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

  // CSRF still loading or failed — JS fallback
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true)
          setError(null)
          void signIn(provider, { callbackUrl }).catch((e) => {
            setPending(false)
            setError(
              e instanceof Error ? e.message : 'Could not start sign-in. Reload and try again.',
            )
          })
        }}
        className={`${baseClass} ${variantClass}`}
      >
        {provider === 'google' ? <GoogleGlyph /> : null}
        {pending ? 'Redirecting…' : label}
      </button>
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
