'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { Button } from '@bevel/ui'
import { BevelCutMark } from '@/components/BevelCutMark'
import { BevelMark } from '@/components/BevelMark'
import { BEVEL_HOME_PATH, BEVEL_NAME } from '@/lib/bevel'

const ONBOARDING_KEY = 'bevel.onboarding.v1'

/**
 * Post-claim first-run: secure namespace confirmed, invite path, open first channel.
 */
export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted">
          Loading onboarding…
        </div>
      }
    >
      <OnboardingInner />
    </Suspense>
  )
}

function OnboardingInner() {
  const { status } = useSession()
  const router = useRouter()
  const params = useSearchParams()
  const workspace = params.get('workspace') || 'your workspace'
  const [doneInvite, setDoneInvite] = useState(false)
  const [doneChannel, setDoneChannel] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=%2Fonboarding')
    }
  }, [status, router])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ONBOARDING_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { invite?: boolean; channel?: boolean }
      setDoneInvite(Boolean(parsed.invite))
      setDoneChannel(Boolean(parsed.channel))
    } catch {
      /* ignore */
    }
  }, [])

  function persist(next: { invite?: boolean; channel?: boolean }) {
    try {
      const raw = window.localStorage.getItem(ONBOARDING_KEY)
      const prev = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
      window.localStorage.setItem(
        ONBOARDING_KEY,
        JSON.stringify({ ...prev, ...next }),
      )
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="bevel-home-atmosphere" aria-hidden="true">
        <div className="bevel-home-mesh" />
        <div className="bevel-home-grid" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-5">
        <Link
          href="/"
          className="flex items-center gap-3 text-foreground transition hover:opacity-90"
        >
          <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
            <BevelCutMark />
          </span>
          <BevelMark size="md" />
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href={BEVEL_HOME_PATH}>Skip to workspace</Link>
        </Button>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Onboarding
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {workspace} is yours
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
          Namespace secured. Next: bring people in, open the first channel, and put an
          agent on the roster. You can finish these anytime inside {BEVEL_NAME}.
        </p>

        <ol className="mt-10 space-y-4">
          <li className="rounded-2xl border border-border bg-surface/50 p-5">
            <div className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-accent">
                <CheckCircleIcon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">Namespace secured</p>
                <p className="mt-1 text-sm text-muted">
                  Slug <code className="font-mono text-foreground">{workspace}</code> is
                  bound to your Google Workspace domain. Channel history and agents use
                  this realtime namespace.
                </p>
              </div>
            </div>
          </li>

          <li className="rounded-2xl border border-border bg-surface/50 p-5">
            <div className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-accent">
                <UserGroupIcon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">Invite the team</p>
                <p className="mt-1 text-sm text-muted">
                  Anyone on your email domain can sign in via the platform entry host and
                  land in this workspace. Share the claim host or{' '}
                  <Link href="/login" className="text-accent hover:underline">
                    sign-in link
                  </Link>{' '}
                  with teammates.
                </p>
                <Button
                  type="button"
                  variant={doneInvite ? 'secondary' : 'outline'}
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setDoneInvite(true)
                    persist({ invite: true })
                    void navigator.clipboard?.writeText(
                      typeof window !== 'undefined' ? window.location.origin : '',
                    )
                  }}
                >
                  {doneInvite ? 'Link copied' : 'Copy workspace link'}
                </Button>
              </div>
            </div>
          </li>

          <li className="rounded-2xl border border-border bg-surface/50 p-5">
            <div className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-accent">
                <ChatBubbleLeftRightIcon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">Open ^general</p>
                <p className="mt-1 text-sm text-muted">
                  Your first shared room for humans and agents. Post once, @mention to
                  focus a specialist.
                </p>
                <Button
                  asChild
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setDoneChannel(true)
                    persist({ channel: true })
                  }}
                >
                  <Link href={`${BEVEL_HOME_PATH}/general`}>Open channel</Link>
                </Button>
              </div>
            </div>
          </li>

          <li className="rounded-2xl border border-border bg-surface/50 p-5">
            <div className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-accent">
                <SparklesIcon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">Meet the fleet</p>
                <p className="mt-1 text-sm text-muted">
                  Click an agent chip for profile + Message, or use Direct → New
                  conversation to start a multi-party thread.
                </p>
              </div>
            </div>
          </li>
        </ol>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={`${BEVEL_HOME_PATH}/general`}>Enter workspace</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
