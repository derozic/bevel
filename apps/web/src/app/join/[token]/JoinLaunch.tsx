'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { LoginPanel } from '@/app/login/LoginPanel'
import type { ConversationLinkPreview } from '@/lib/conversation-link'
import './join-launch.css'

export function JoinLaunch({
  token,
  preview,
  signedIn,
  callbackUrl,
  csrfToken,
  googleOk,
  appleOk,
  microsoftOk,
  otpOk,
  pinAccepted = false,
  outsideBlocked = false,
  org = 'this workspace',
}: {
  token: string
  preview: ConversationLinkPreview
  signedIn: boolean
  callbackUrl: string
  csrfToken?: string | null
  googleOk: boolean
  appleOk: boolean
  microsoftOk: boolean
  otpOk: boolean
  pinAccepted?: boolean
  outsideBlocked?: boolean
  org?: string
}) {
  const open = preview.status === 'active'
  const names = preview.agentIds.map((id) => id.charAt(0).toUpperCase() + id.slice(1))
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinAcceptedLocal, setPinAcceptedLocal] = useState(false)
  const [pinBusy, setPinBusy] = useState(false)
  const pinLength = preview.pinLength ?? 4

  async function submitPin(event: FormEvent) {
    event.preventDefault()
    setPinBusy(true)
    setPinError(null)
    try {
      const res = await fetch(`/api/conversation-links/${encodeURIComponent(token)}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        href?: string
        error?: string
        needsSignIn?: boolean
      }
      if (!res.ok) {
        setPinError(data.error || 'That code does not match')
        return
      }
      if (data.needsSignIn || !data.href) {
        setPinAcceptedLocal(true)
        return
      }
      window.location.assign(data.href)
    } catch {
      setPinError('That code does not match')
    } finally {
      setPinBusy(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      window.location.assign(`bevel://join/${token}`)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [open, token])

  return (
    <main className="bevel-join">
      <div className="bevel-join-orbit" data-live={open ? 'true' : 'false'} aria-hidden>
        <span className="bevel-join-comet" />
        <span className="bevel-join-mark">B</span>
      </div>
      <h1>{open ? 'Opening BEVEL…' : 'This link is closed'}</h1>
      {open ? (
        <>
          <p className="bevel-join-lead">
            {preview.title || 'A conversation'}
            {names.length > 0 ? ` · ${names.join(', ')}` : ''}
          </p>
          <p className="bevel-join-copy">
            Your browser should prompt you to open BEVEL.
            {preview.pinRequired
              ? ' Enter the code from the person who sent the link, or sign in below.'
              : ' The agents in this conversation stay behind sign-in.'}
          </p>
          {outsideBlocked ? (
            <p className="bevel-join-copy">
              This conversation is limited to {org}. Sign in with an email on that domain.
            </p>
          ) : null}
          {(pinAccepted || pinAcceptedLocal) && preview.verify === 'double' ? (
            <p className="bevel-join-copy">Code accepted. Sign in below to finish. Both are required.</p>
          ) : null}
          {preview.pinRequired && !signedIn && !pinAccepted && !pinAcceptedLocal ? (
            <form className="bevel-join-pin" onSubmit={(event) => void submitPin(event)}>
              <label htmlFor="bevel-join-pin">
                {pinLength}-digit code
              </label>
              <input
                id="bevel-join-pin"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern={`\\d{${pinLength}}`}
                maxLength={pinLength}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, pinLength))}
              />
              <button type="submit" disabled={pinBusy || pin.length !== pinLength}>
                {pinBusy ? 'Checking…' : 'Enter'}
              </button>
              {pinError ? <p role="alert">{pinError}</p> : null}
            </form>
          ) : null}
          <p className="bevel-join-copy">
            Nothing happened?{' '}
            <a href={`bevel://join/${token}`}>Open the app</a>
            {signedIn ? null : ', or sign in below to continue here.'}
          </p>
          {signedIn ? (
            <p className="bevel-join-copy">Sign-in succeeded, but this seat could not be opened. Try the link again.</p>
          ) : (
            <div className="bevel-join-auth">
              <LoginPanel
                callbackUrl={callbackUrl}
                csrfToken={csrfToken}
                googleOk={googleOk}
                appleOk={appleOk}
                microsoftOk={microsoftOk}
                otpOk={otpOk}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <p className="bevel-join-lead">
            {preview.status === 'expired'
              ? 'This link expired after 7 days.'
              : preview.status === 'revoked'
                ? 'The person who shared this link closed it.'
                : 'This link is not valid.'}
          </p>
          <p className="bevel-join-copy">
            <Link href="/">Back to BEVEL</Link>
          </p>
        </>
      )}
    </main>
  )
}
