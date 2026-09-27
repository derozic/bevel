'use client'

import { useState } from 'react'
import { LinkIcon } from '@heroicons/react/24/outline'

export function ConversationLinkButton({
  targetKind,
  targetId,
  title,
  agentIds,
}: {
  targetKind: 'channel' | 'session'
  targetId: string
  title: string
  agentIds: string[]
}) {
  const [open, setOpen] = useState(false)
  const [expire, setExpire] = useState(true)
  const [pinOn, setPinOn] = useState(false)
  const [pinLength, setPinLength] = useState<4 | 6 | 8>(4)
  const [pin, setPin] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function createLink() {
    if (pinOn && pin.length !== pinLength) {
      setError(`Enter a ${pinLength}-digit code`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/conversation-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetKind,
          targetId,
          title,
          agentIds,
          expireInDays: expire ? 7 : null,
          pin: pinOn ? pin : null,
          pinLength: pinOn ? pinLength : null,
          allowOutside: false,
          verify: pinOn ? 'double' : 'single',
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not create the link')
        return
      }
      setUrl(data.url)
      try {
        await navigator.clipboard.writeText(data.url)
      } catch {
        /* the field still shows the URL */
      }
    } catch {
      setError('Could not create the link')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold text-[var(--sticker-muted,#5c564e)] hover:bg-[color-mix(in_srgb,var(--ink,#1a1410)_6%,transparent)]"
        onClick={() => setOpen((value) => !value)}
      >
        <LinkIcon className="h-3.5 w-3.5" aria-hidden />
        Link
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-[color-mix(in_srgb,var(--ink,#1a1410)_12%,transparent)] bg-[var(--surface,#f7f3ec)] p-3 text-left shadow-lg">
          <p className="text-sm font-semibold text-[var(--ink,#1a1410)]">Anyone with the link</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--sticker-muted,#5c564e)]">
            They can sign in, or use a PIN if you set one.
          </p>
          <label className="mt-3 flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={pinOn}
              onChange={(event) => {
                setPinOn(event.target.checked)
                setUrl(null)
              }}
            />
            Protect with a PIN
          </label>
          {pinOn ? (
            <div className="mt-2 flex items-center gap-2">
              <select
                className="h-8 rounded-md border border-[color-mix(in_srgb,var(--ink,#1a1410)_16%,transparent)] bg-transparent px-1 text-xs"
                value={pinLength}
                onChange={(event) => {
                  const next = Number(event.target.value) as 4 | 6 | 8
                  setPinLength(next)
                  setPin('')
                  setUrl(null)
                }}
              >
                <option value={4}>4 digits</option>
                <option value={6}>6 digits</option>
                <option value={8}>8 digits</option>
              </select>
              <input
                className="h-8 min-w-0 flex-1 rounded-md border border-[color-mix(in_srgb,var(--ink,#1a1410)_16%,transparent)] bg-transparent px-2 text-sm tracking-[0.2em]"
                inputMode="numeric"
                maxLength={pinLength}
                value={pin}
                placeholder={pinLength === 4 ? '0000' : pinLength === 6 ? '000000' : '00000000'}
                onChange={(event) => {
                  setPin(event.target.value.replace(/\D/g, '').slice(0, pinLength))
                  setUrl(null)
                }}
              />
            </div>
          ) : null}
          <label className="mt-3 flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={expire}
              onChange={(event) => {
                setExpire(event.target.checked)
                setUrl(null)
              }}
            />
            Expire in 7 days
          </label>
          <button
            type="button"
            className="mt-3 h-8 w-full rounded-full bg-[#1a1410] text-xs font-semibold text-[#f3eee6] disabled:opacity-60"
            disabled={busy}
            onClick={() => void createLink()}
          >
            {busy ? 'Creating…' : 'Copy link'}
          </button>
          {url ? (
            <p className="mt-2 break-all text-[11px] leading-snug text-[var(--ink,#1a1410)]">
              {url}
              {pinOn ? ` · PIN ${pin}` : ''}
            </p>
          ) : null}
          {error ? (
            <p className="mt-2 text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
