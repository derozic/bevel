'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowDownTrayIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { Button } from '@bevel/ui'
import { BevelCutMark } from '@/components/BevelCutMark'
import { BevelMark } from '@/components/BevelMark'
import { BEVEL_NAME } from '@/lib/bevel'
import {
  ONBOARDING_HREFS,
  ONBOARDING_STORAGE_KEY,
  parseOnboardingProgress,
  type OnboardingProgress,
} from '@/lib/onboarding'

/**
 * First-run: Private (apex) or org claim. Destinations stay on canonical paths
 * (`/me`, `/talk/hermes`, `/~general`) — never `/~general/general`.
 */
export function OnboardingFlow() {
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
    /* ignore */
  }
}

function OnboardingInner() {
  const { status } = useSession()
  const router = useRouter()
  const params = useSearchParams()
  const workspace = params.get('workspace')
  const orgMode = Boolean(workspace)
  const [doneInvite, setDoneInvite] = useState(false)
  const [doneChannel, setDoneChannel] = useState(false)
  const [doneHermes, setDoneHermes] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=%2Fonboarding')
    }
  }, [status, router])

  useEffect(() => {
    const parsed = parseOnboardingProgress(
      window.localStorage.getItem(ONBOARDING_STORAGE_KEY),
    )
    setDoneInvite(Boolean(parsed.invite))
    setDoneChannel(Boolean(parsed.channel))
    setDoneHermes(Boolean(parsed.hermes))
  }, [])

  const skipHref = orgMode ? ONBOARDING_HREFS.channel : ONBOARDING_HREFS.privateHome

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
          <Link href={skipHref}>Skip to workspace</Link>
        </Button>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Onboarding
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {orgMode ? `${workspace} is yours` : 'Private is ready'}
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
          {orgMode
            ? `Namespace secured. Next: bring people in, open ~general, and put an agent on the roster. You can finish these anytime inside ${BEVEL_NAME}.`
            : `You and your agents — no org required. Talk to Hermes, install the app, or claim a workspace when the team needs a shared channel.`}
        </p>

        <ol className="mt-10 space-y-4">
          <li className="rounded-2xl border border-border bg-surface/50 p-5">
            <div className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-accent">
                <CheckCircleIcon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">
                  {orgMode ? 'Namespace secured' : 'Signed in'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {orgMode ? (
                    <>
                      Slug{' '}
                      <code className="font-mono text-foreground">{workspace}</code> is
                      bound to your Google Workspace domain. Channel history and agents
                      use this realtime namespace.
                    </>
                  ) : (
                    <>
                      Private lives on this host. Direct threads persist as{' '}
                      <code className="font-mono text-foreground">/talk/hermes</code>.
                      Org channels stay optional.
                    </>
                  )}
                </p>
              </div>
            </div>
          </li>

          {orgMode ? (
            <>
              <li className="rounded-2xl border border-border bg-surface/50 p-5">
                <div className="flex items-start gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-accent">
                    <UserGroupIcon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">Invite the team</p>
                    <p className="mt-1 text-sm text-muted">
                      Anyone on your email domain can sign in via the platform entry
                      host and land in this workspace.
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
                    <p className="font-semibold text-foreground">Open ~general</p>
                    <p className="mt-1 text-sm text-muted">
                      Your first shared room for humans and agents. Post once, @mention
                      to focus a specialist.
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
                      <Link href={ONBOARDING_HREFS.channel}>Open channel</Link>
                    </Button>
                  </div>
                </div>
              </li>
            </>
          ) : (
            <>
              <li className="rounded-2xl border border-border bg-surface/50 p-5">
                <div className="flex items-start gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-accent">
                    <SparklesIcon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">Talk to Hermes</p>
                    <p className="mt-1 text-sm text-muted">
                      Your personal agent. Direct threads resume on refresh — same URL.
                    </p>
                    <Button
                      asChild
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        setDoneHermes(true)
                        persist({ hermes: true, privateDone: true })
                      }}
                    >
                      <Link href={ONBOARDING_HREFS.hermes}>Open conversation</Link>
                    </Button>
                  </div>
                </div>
              </li>

              <li className="rounded-2xl border border-border bg-surface/50 p-5">
                <div className="flex items-start gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-accent">
                    <ArrowDownTrayIcon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">Install the app</p>
                    <p className="mt-1 text-sm text-muted">
                      Native Flutter client for iPhone, Android, and Mac. Browser stays
                      available.
                    </p>
                    <Button asChild variant="outline" size="sm" className="mt-3">
                      <Link href={ONBOARDING_HREFS.download}>Download</Link>
                    </Button>
                  </div>
                </div>
              </li>
            </>
          )}

          <li className="rounded-2xl border border-border bg-surface/50 p-5">
            <div className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-accent">
                {orgMode ? (
                  <SparklesIcon className="size-5" aria-hidden />
                ) : (
                  <UserGroupIcon className="size-5" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">
                  {orgMode ? 'Meet the fleet' : 'Claim a team workspace'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {orgMode
                    ? 'Open an agent profile, then Message — or start a multi-party thread from Direct.'
                    : 'When the org needs shared channels and history, claim a namespace for your domain.'}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link
                    href={orgMode ? ONBOARDING_HREFS.talk : ONBOARDING_HREFS.claim}
                  >
                    {orgMode ? 'Browse agents' : 'Claim workspace'}
                  </Link>
                </Button>
              </div>
            </div>
          </li>
        </ol>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={skipHref}>
              {orgMode ? 'Enter workspace' : 'Open Private'}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={orgMode ? ONBOARDING_HREFS.workspaces : '/'}>
              {orgMode ? 'All spaces' : 'Back to home'}
            </Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
