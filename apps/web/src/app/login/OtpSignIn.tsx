'use client'

import { useEffect, useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import type { OtpChannel } from '@bevel/auth'
import { detectOtpChannel, writeLastUsedMethod } from './login-methods'

const RESEND_SEC = 45

/**
 * Unified mobile-or-email destination, then one long OTP line.
 * Email → magic link + 6-digit backup. Phone → SMS code.
 */
export function OtpSignIn({
  callbackUrl = '/welcome',
  onStepChange,
}: {
  callbackUrl?: string
  onStepChange?: (step: 'dest' | 'code') => void
}) {
  const [destination, setDestination] = useState('')
  const [channel, setChannel] = useState<OtpChannel>('sms')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'dest' | 'code'>('dest')
  const [masked, setMasked] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const verifying = useRef(false)
  const otpInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onStepChange?.(step)
  }, [step, onStepChange])

  useEffect(() => {
    if (resendIn <= 0) return
    const id = window.setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearTimeout(id)
  }, [resendIn])

  useEffect(() => {
    if (step === 'code') otpInput.current?.focus()
  }, [step])

  const sendCode = async (dest = destination, forced?: OtpChannel) => {
    const detected = forced ?? detectOtpChannel(dest)
    if (!detected) {
      setError('Enter a mobile number or an email address.')
      return
    }
    setPending(true)
    setError(null)
    setDevCode(null)
    setChannel(detected)
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: detected, destination: dest.trim() }),
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
              : 'Could not send a code.'),
        )
        return
      }
      setMasked(data.masked ?? dest)
      setStep('code')
      setResendIn(RESEND_SEC)
      if (data.devCode) setDevCode(data.devCode)
    } catch {
      setError('Network error — try again.')
    } finally {
      setPending(false)
    }
  }

  const verify = async (value = code) => {
    const trimmed = value.trim()
    if (trimmed.length < 6 || verifying.current) return
    verifying.current = true
    setPending(true)
    setError(null)
    try {
      const result = await signIn('otp', {
        redirect: false,
        callbackUrl,
        channel,
        otp: trimmed,
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
        verifying.current = false
        return
      }
      writeLastUsedMethod(channel === 'email' ? 'email-link' : 'phone')
      if (result?.url) {
        window.location.href = result.url
        return
      }
      window.location.href = callbackUrl
    } catch {
      setError('Sign-in failed. Try again.')
      setPending(false)
      verifying.current = false
    }
  }

  useEffect(() => {
    if (step === 'code' && code.length === 6 && !pending) {
      void verify(code)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step])

  if (step === 'code') {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Enter the code we sent</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {channel === 'email'
              ? 'Check your inbox for the link, or type the 6-digit backup sent to '
              : 'We texted a 6-digit code to '}
            <span className="font-medium text-foreground">{masked}</span>.
          </p>
        </div>
        {devCode ? (
          <p className="rounded-xl border border-dashed border-accent/40 bg-accent/10 px-3 py-2 text-center font-mono text-xs text-accent">
            Dev code: {devCode}
          </p>
        ) : null}
        <label className="block">
          <span className="sr-only">One-time code</span>
          <input
            ref={otpInput}
            className="login-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder=""
            value={code}
            aria-label="One-time code"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
          disabled={pending || code.length < 6}
          onClick={() => void verify()}
          className="login-provider login-provider--apple"
        >
          {pending ? 'Verifying…' : 'Verify and sign in'}
        </button>
        <div className="flex flex-col gap-2 text-center text-xs">
          <button
            type="button"
            disabled={pending || resendIn > 0}
            className="font-medium text-muted hover:text-foreground disabled:opacity-50"
            onClick={() => void sendCode(destination, channel)}
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
          </button>
          <button
            type="button"
            className="font-medium text-muted hover:text-foreground"
            onClick={() => {
              setStep('dest')
              setCode('')
              setError(null)
              verifying.current = false
            }}
          >
            Use a different number or email
          </button>
        </div>
        {error ? (
          <p className="text-center text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="sr-only">Mobile or email</span>
        <input
          className="login-dest"
          type="text"
          inputMode="email"
          autoComplete="username"
          placeholder="Mobile or email"
          value={destination}
          aria-label="Mobile or email"
          data-cta="phone"
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
        className="login-provider"
        data-cta="email-link"
      >
        {pending ? 'Sending…' : 'Continue'}
      </button>
      {error ? (
        <p className="text-center text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
