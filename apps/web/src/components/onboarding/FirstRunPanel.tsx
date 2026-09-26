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
      className="public-panel !p-5"
      aria-label="First-run checklist"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
        First run
      </p>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {mode === 'private'
          ? 'Start a thread with your primary agent. Claim a workspace when the team needs a shared channel.'
          : 'Namespace is live. Open ~general, invite the domain, and put an agent on the roster.'}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {mode === 'private' ? (
          <>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href={ONBOARDING_HREFS.claim}>Claim workspace</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link href={ONBOARDING_HREFS.download}>Download app</Link>
            </Button>
          </>
        ) : (
          <>
            <Button asChild size="sm" className="rounded-full">
              <Link href={ONBOARDING_HREFS.channel}>Open ~general</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href={ONBOARDING_HREFS.talk}>Meet the fleet</Link>
            </Button>
          </>
        )}
        <Button asChild variant="ghost" size="sm" className="rounded-full">
          <Link href="/onboarding">Checklist</Link>
        </Button>
        <button
          type="button"
          className="ml-auto rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface hover:text-foreground"
          onClick={dismiss}
        >
          Dismiss
        </button>
      </div>
    </aside>
  )
}
