'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@bevel/ui'
import {
  ONBOARDING_HREFS,
  ONBOARDING_STORAGE_KEY,
  parseOnboardingProgress,
  shouldShowFirstRun,
  type OnboardingMode,
  type OnboardingProgress,
} from '@/lib/onboarding'

function persist(next: OnboardingProgress) {
  try {
    const prev = parseOnboardingProgress(
      window.localStorage.getItem(ONBOARDING_STORAGE_KEY),
    )
    window.localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({ ...prev, ...next }),
    )
  } catch {
    /* ignore quota / private mode */
  }
}

export function FirstRunPanel({ mode }: { mode: OnboardingMode }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      const progress = parseOnboardingProgress(
        window.localStorage.getItem(ONBOARDING_STORAGE_KEY),
      )
      setShow(shouldShowFirstRun(progress, mode))
    } catch {
      setShow(true)
    }
  }, [mode])

  if (!show) return null

  const dismiss = () => {
    persist(mode === 'private' ? { privateDone: true } : { channel: true })
    setShow(false)
  }

  return (
    <aside
      className="rounded-2xl border border-accent/30 bg-accent/5 p-5"
      aria-label="First-run checklist"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            First run
          </p>
          <p className="text-sm leading-relaxed text-muted">
            {mode === 'private'
              ? 'Private is yours. Talk to Hermes, then claim an org workspace when the team needs a channel.'
              : 'Namespace is live. Open ~general, invite the domain, and put an agent on the roster.'}
          </p>
        </div>
        <button
          type="button"
          className="text-xs font-medium text-muted hover:text-foreground"
          onClick={dismiss}
        >
          Dismiss
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {mode === 'private' ? (
          <>
            <Button asChild size="sm">
              <Link href={ONBOARDING_HREFS.hermes}>Talk to Hermes</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={ONBOARDING_HREFS.claim}>Claim workspace</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={ONBOARDING_HREFS.download}>Download app</Link>
            </Button>
          </>
        ) : (
          <>
            <Button asChild size="sm">
              <Link href={ONBOARDING_HREFS.channel}>Open ~general</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={ONBOARDING_HREFS.talk}>Meet the fleet</Link>
            </Button>
          </>
        )}
        <Button asChild variant="ghost" size="sm">
          <Link href="/onboarding">Full checklist</Link>
        </Button>
      </div>
    </aside>
  )
}
