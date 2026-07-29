'use client'

import { useEffect, useMemo, useState } from 'react'
import { getCsrfToken, signIn } from 'next-auth/react'

/**
 * Google / GitHub sign-in.
 *
 * Primary path: native form POST to Auth.js (no Next server actions).
 *
 * When AUTH_URL pins a platform origin (e.g. https://bevel.is), OAuth PKCE
 * cookies are host-only on that host and Google's redirect_uri matches it.
 * Starting sign-in on a different host (e.g. bevel.2x4m.cc) leaves the PKCE
 * cookie there → InvalidCheck / Configuration on callback.
 *
 * The server passes `pageOrigin` so the hop is decided on first paint (no
 * useEffect race that briefly renders a same-host form on org hosts).
 */
export function GoogleSignInButton({
  callbackUrl = '/welcome',
  label = 'Continue with Google Workspace',
  oauthOrigin,
  pageOrigin: pageOriginProp,
}: {
  callbackUrl?: string
  label?: string
  /** AUTH_URL origin when pinned; omit for same-host AUTH_TRUST_HOST OAuth. */
  oauthOrigin?: string
  /** Request origin from the server (https://host). Avoids client hop race. */
  pageOrigin?: string
}) {
  return (
    <OAuthSignInButton
      provider="google"
      callbackUrl={callbackUrl}
      label={label}
      variant="primary"
      oauthOrigin={oauthOrigin}
      pageOriginProp={pageOriginProp}
    />
  )
}

export function GitHubSignInButton({
  callbackUrl = '/welcome',
  label = 'Continue with GitHub',
  oauthOrigin,
  pageOrigin: pageOriginProp,
}: {
  callbackUrl?: string
  label?: string
  oauthOrigin?: string
  pageOrigin?: string
}) {
  return (
    <OAuthSignInButton
      provider="github"
      callbackUrl={callbackUrl}
      label={label}
      variant="outline"
      oauthOrigin={oauthOrigin}
      pageOriginProp={pageOriginProp}
    />
  )
}

function platformLoginHref(
  oauthOrigin: string,
  callbackUrl: string,
  pageOrigin: string,
): string {
  let returnTo = callbackUrl
  if (callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')) {
    try {
      if (new URL(oauthOrigin).origin !== pageOrigin) {
        returnTo = new URL(callbackUrl, pageOrigin).href
      }
    } catch {
      /* keep relative */
    }
  }
  const u = new URL('/login', oauthOrigin)
  u.searchParams.set('callbackUrl', returnTo)
  return u.toString()
}

function normalizeOrigin(raw: string | undefined | null): string | null {
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    try {
      return new URL(`https://${raw}`).origin
    } catch {
      return null
    }
  }
}

function OAuthSignInButton({
  provider,
  callbackUrl,
  label,
  variant,
  oauthOrigin,
  pageOriginProp,
}: {
  provider: 'google' | 'github'
  callbackUrl: string
  label: string
  variant: 'primary' | 'outline'
  oauthOrigin?: string
  pageOriginProp?: string
}) {
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectedOrigin, setDetectedOrigin] = useState<string | null>(null)
  // Prefer server-provided page origin; fall back to window only for client pages.
  const [clientOrigin, setClientOrigin] = useState<string | null>(() =>
    typeof window !== 'undefined' ? window.location.origin : null,
  )

  useEffect(() => {
    setClientOrigin(window.location.origin)
  }, [])

  const pinnedOrigin = useMemo(
    () => normalizeOrigin(oauthOrigin || detectedOrigin),
    [oauthOrigin, detectedOrigin],
  )

  const pageOrigin = useMemo(
    () => normalizeOrigin(pageOriginProp) || clientOrigin,
    [pageOriginProp, clientOrigin],
  )

  // Hop when AUTH_URL (or provider callback) is a different host than this page.
  const mustHopToPlatform = Boolean(
    pinnedOrigin && pageOrigin && pinnedOrigin !== pageOrigin,
  )

  // Discover AUTH_URL pin from provider callbacks when prop is omitted (/claim).
  useEffect(() => {
    if (oauthOrigin) return
    let cancelled = false
    void fetch('/api/auth/providers', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Record<string, { callbackUrl?: string }> | null) => {
        if (cancelled || !data) return
        const cb =
          data[provider]?.callbackUrl ||
          data.google?.callbackUrl ||
          data.github?.callbackUrl
        if (!cb) return
        setDetectedOrigin(normalizeOrigin(cb))
      })
      .catch(() => {
        /* same-host OAuth fallback */
      })
    return () => {
      cancelled = true
    }
  }, [oauthOrigin, provider])

  useEffect(() => {
    if (mustHopToPlatform) return
    // Still waiting to learn whether we must hop (claim page, no oauthOrigin yet).
    if (!oauthOrigin && !detectedOrigin && !pageOriginProp) return
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
  }, [mustHopToPlatform, oauthOrigin, detectedOrigin, pageOriginProp])

  const baseClass =
    'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60'
  const variantClass =
    variant === 'primary'
      ? 'border-2 border-gray-900 bg-gray-900 text-white hover:bg-white hover:text-gray-900'
      : 'border-2 border-gray-300 bg-white text-gray-900 hover:border-gray-900'

  // AUTH_URL pin on a different host: never render a same-host form (PKCE would break).
  if (mustHopToPlatform && pinnedOrigin && pageOrigin) {
    const href = platformLoginHref(pinnedOrigin, callbackUrl, pageOrigin)
    return (
      <a href={href} className={`${baseClass} ${variantClass}`}>
        {provider === 'google' ? <GoogleGlyph /> : null}
        {label}
      </a>
    )
  }

  // Waiting for origin detection on client-only pages — avoid wrong-host form.
  if (oauthOrigin === undefined && !detectedOrigin && !pageOriginProp) {
    return (
      <button type="button" disabled className={`${baseClass} ${variantClass}`}>
        {provider === 'google' ? <GoogleGlyph /> : null}
        Preparing sign-in…
      </button>
    )
  }

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
            const form = event.currentTarget
            const input = form.elements.namedItem(
              'csrfToken',
            ) as HTMLInputElement | null
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
              e instanceof Error
                ? e.message
                : 'Could not start sign-in. Reload and try again.',
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
