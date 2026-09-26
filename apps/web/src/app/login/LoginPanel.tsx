'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  GoogleSignInButton,
  MicrosoftSignInButton,
} from './GoogleSignInButton'
import { OtpSignIn } from './OtpSignIn'
import {
  APPLE_NOT_CONFIGURED,
  GOOGLE_NOT_CONFIGURED,
  LOGIN_METHODS,
  MICROSOFT_NOT_CONFIGURED,
  readLastUsedMethod,
  writeLastUsedMethod,
  type LoginMethodCta,
} from './login-methods'

export function LoginPanel({
  callbackUrl,
  csrfToken,
  googleOk,
  appleOk,
  microsoftOk,
}: {
  callbackUrl: string
  csrfToken?: string | null
  googleOk: boolean
  appleOk: boolean
  microsoftOk: boolean
  otpOk: boolean
}) {
  const [otpStep, setOtpStep] = useState<'dest' | 'code'>('dest')
  const [appleReady, setAppleReady] = useState(appleOk)
  const [microsoftReady, setMicrosoftReady] = useState(microsoftOk)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [appleError, setAppleError] = useState<string | null>(null)
  const [microsoftError, setMicrosoftError] = useState<string | null>(null)
  const [appleLoading, setAppleLoading] = useState(false)
  const [lastUsed, setLastUsed] = useState<LoginMethodCta | null>(null)

  useEffect(() => {
    setLastUsed(readLastUsedMethod())
  }, [])

  useEffect(() => {
    void fetch('/api/auth/apple/status', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { configured?: boolean } | null) => {
        if (data && data.configured === false) setAppleReady(false)
        if (data && data.configured === true) setAppleReady(true)
      })
      .catch(() => {
        /* keep the Apple button; click reports the real error */
      })
  }, [])

  useEffect(() => {
    void fetch('/api/auth/microsoft/status', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { configured?: boolean } | null) => {
        if (data && data.configured === false) setMicrosoftReady(false)
        if (data && data.configured === true) setMicrosoftReady(true)
      })
      .catch(() => {
        /* keep the Microsoft button; click reports the real error */
      })
  }, [])

  const google = LOGIN_METHODS[0]
  const apple = LOGIN_METHODS[1]
  const microsoft = LOGIN_METHODS[2]!
  const appleReturn = callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
    ? callbackUrl
    : '/welcome'

  const showProviders = otpStep === 'dest'

  return (
    <div className="space-y-3">
      {showProviders && googleOk ? (
        <GoogleSignInButton
          callbackUrl={callbackUrl}
          csrfToken={csrfToken}
          lastUsed={lastUsed === 'google'}
        />
      ) : showProviders ? (
        <div className="relative">
          {lastUsed === 'google' ? (
            <span className="login-last-used">Last used</span>
          ) : null}
          <button
            type="button"
            className="login-provider"
            data-cta={google.cta}
            onClick={() => setGoogleError(GOOGLE_NOT_CONFIGURED)}
          >
            {google.label}
          </button>
        </div>
      ) : null}

      {showProviders ? (
      <a
        href={`/auth/apple?return_to=${encodeURIComponent(appleReturn)}`}
        className="login-provider login-provider--apple"
        data-cta={apple.cta}
        title={
          appleReady
            ? 'Sign in with Apple'
            : 'Apple sign-in is not configured on this server yet'
        }
        onClick={() => {
          setAppleLoading(true)
          writeLastUsedMethod('apple')
          if (!appleReady) {
            setAppleError(APPLE_NOT_CONFIGURED)
          }
        }}
      >
        <AppleMark />
        {appleLoading ? 'Signing in...' : apple.label}
        {lastUsed === 'apple' ? (
          <span className="login-last-used">Last used</span>
        ) : null}
      </a>
      ) : null}

      {showProviders ? (
      <MicrosoftSignInButton
        callbackUrl={callbackUrl}
        csrfToken={csrfToken}
        label={microsoft.label}
        lastUsed={lastUsed === 'microsoft'}
        configured={microsoftReady}
        onUnconfigured={() => setMicrosoftError(MICROSOFT_NOT_CONFIGURED)}
      />
      ) : null}

      {showProviders ? (
      <div className="flex items-center gap-3 py-1" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      ) : null}

      <OtpSignIn callbackUrl={callbackUrl} onStepChange={setOtpStep} />

      {showProviders ? (
      <p className="pt-2 text-center text-[13px] leading-relaxed text-muted">
        By continuing, you agree to the{' '}
        <Link
          href="/terms"
          className="text-foreground underline decoration-current/30 underline-offset-2 hover:decoration-current/70"
        >
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link
          href="/privacy"
          className="text-foreground underline decoration-current/30 underline-offset-2 hover:decoration-current/70"
        >
          Privacy Policy
        </Link>
        .
      </p>
      ) : null}

      {googleError ? (
        <p className="text-center text-sm text-danger" role="alert">
          {googleError}
        </p>
      ) : null}
      {appleError ? (
        <p className="text-center text-sm text-danger" role="alert">
          {appleError}
        </p>
      ) : null}
      {microsoftError ? (
        <p className="text-center text-sm text-danger" role="alert">
          {microsoftError}
        </p>
      ) : null}
    </div>
  )
}

function AppleMark() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.42 2.2-1.18 3.02-.79.85-2.1 1.5-3.22 1.41-.13-1.1.4-2.25 1.16-3.08.79-.87 2.16-1.5 3.24-1.35zM20.76 17.2c-.55 1.27-.81 1.84-1.52 2.96-1 1.56-2.4 3.5-4.13 3.52-1.54.02-1.93-.99-4.02-.98-2.09.01-2.52 1-4.06.98-1.73-.02-3.05-1.77-4.05-3.33-2.79-4.36-3.08-9.48-1.36-12.2 1.22-1.93 3.15-3.06 4.96-3.06 1.85 0 3.01 1.01 4.54 1.01 1.49 0 2.4-1.02 4.54-1.02 1.61 0 3.31.88 4.52 2.39-3.97 2.18-3.33 7.86.58 9.73z" />
    </svg>
  )
}
