'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import type { OtpChannel } from '@bevel/auth'

/**
 * Email or SMS one-time code sign-in.
 * 1) send code → 2) verify via Auth.js credentials provider "otp"
 */
export function OtpSignIn({
  callbackUrl = '/welcome',
}: {
  callbackUrl?: string
}) {
  const [channel, setChannel] = useState<OtpChannel>('email')
  const [destination, setDestination] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'dest' | 'code'>('dest')
  const [masked, setMasked] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const sendCode = async () => {
    setPending(true)
    setError(null)
    setInfo(null)
    setDevCode(null)
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, destination: destination.trim() }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        masked?: string
        simulated?: boolean
        devCode?: string
      }
      if (!res.ok) {
        setError(
          data.error ??
            (res.status === 402
              ? 'Mobile OTP requires a paid BEVEL plan. Use email or Google.'
              : 'Could not send code'),
        )
        return
      }
      setMasked(data.masked ?? destination)
      setStep('code')
      setInfo(
        data.simulated
          ? `Code sent (dev simulation) to ${data.masked ?? 'you'}.`
          : `Code sent to ${data.masked ?? 'you'}.`,
      )
      if (data.devCode) setDevCode(data.devCode)
    } catch {
      setError('Network error — try again.')
    } finally {
      setPending(false)
    }
  }

  const verify = async () => {
    setPending(true)
    setError(null)
    try {
      const result = await signIn('otp', {
        redirect: false,
        callbackUrl,
        channel,
        otp: code.trim(),
        ...(channel === 'email'
          ? { email: destination.trim() }
          : { phone: destination.trim() }),
      })
      if (result?.error) {
        setError(
          result.error === 'CredentialsSignin'
            ? 'Invalid or expired code. Request a new one.'
            : result.error,
        )
        setPending(false)
        return
      }
      if (result?.url) {
        window.location.href = result.url
        return
      }
      window.location.href = callbackUrl
    } catch {
      setError('Sign-in failed. Try again.')
      setPending(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          Sign in with a code
        </p>
        <div className="flex rounded-lg border border-border p-0.5 text-xs">
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              channel === 'email'
                ? 'bg-accent text-white'
                : 'text-muted hover:text-foreground'
            }`}
            onClick={() => {
              setChannel('email')
              setStep('dest')
              setCode('')
              setError(null)
            }}
          >
            Email
          </button>
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              channel === 'sms'
                ? 'bg-accent text-white'
                : 'text-muted hover:text-foreground'
            }`}
            onClick={() => {
              setChannel('sms')
              setStep('dest')
              setCode('')
              setError(null)
            }}
          >
            Mobile
          </button>
        </div>
      </div>

      {step === 'dest' ? (
        <>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">
              {channel === 'email' ? 'Work email' : 'Mobile number'}
            </span>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
              type={channel === 'email' ? 'email' : 'tel'}
              inputMode={channel === 'email' ? 'email' : 'tel'}
              autoComplete={channel === 'email' ? 'email' : 'tel'}
              placeholder={
                channel === 'email' ? 'you@company.com' : '+15551234567'
              }
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void sendCode()
                }
              }}
            />
          </label>
          <button
            type="button"
            disabled={pending || !destination.trim()}
            onClick={() => void sendCode()}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-surface text-sm font-semibold text-foreground transition hover:bg-accent/10 disabled:opacity-60"
          >
            {pending ? 'Sending…' : 'Send code'}
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted">
            Enter the 6-digit code sent to{' '}
            <span className="font-medium text-foreground">{masked}</span>
          </p>
          {devCode ? (
            <p className="rounded-lg border border-dashed border-accent/40 bg-accent/5 px-3 py-2 font-mono text-xs text-accent">
              Dev code: {devCode}
            </p>
          ) : null}
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">One-time code</span>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-lg tracking-[0.3em] outline-none focus:border-accent"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void verify()
                }
              }}
            />
          </label>
          <button
            type="button"
            disabled={pending || code.trim().length < 4}
            onClick={() => void verify()}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? 'Verifying…' : 'Verify and sign in'}
          </button>
          <button
            type="button"
            className="w-full text-center text-xs font-medium text-muted hover:text-foreground"
            onClick={() => {
              setStep('dest')
              setCode('')
              setError(null)
              setInfo(null)
            }}
          >
            Use a different {channel === 'email' ? 'email' : 'number'}
          </button>
        </>
      )}

      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {info && !error ? (
        <p className="text-xs text-muted" role="status">
          {info}
        </p>
      ) : null}
    </div>
  )
}
