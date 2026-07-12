'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button, cn } from '@bevel/ui'
import { BevelMark } from '@/components/BevelMark'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { BEVEL_NAME } from '@/lib/bevel'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48)
}

/**
 * Claim-workspace pipeline: secure an org namespace after Google sign-in.
 * Creates tenants/{slug} on disk and routes into onboarding.
 */
export default function ClaimPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'intro' | 'form' | 'done'>('intro')

  const email = session?.user?.email ?? ''
  const emailDomain = email.split('@')[1] ?? ''

  useEffect(() => {
    if (status === 'authenticated') setStep('form')
  }, [status])

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name))
  }, [name, slugTouched])

  const hostPreview = useMemo(() => {
    const s = slug || 'your-org'
    return `${s}.bevel.lvh.me`
  }, [slug])

  async function claim() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/claim/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, slug }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        slug?: string
        url?: string
      }
      if (!res.ok) {
        setError(data.error || `Could not claim workspace (${res.status})`)
        return
      }
      setStep('done')
      // Soft multi-tenant: stay on this host for onboarding when claim host lacks Caddy yet
      router.push(`/onboarding?workspace=${encodeURIComponent(data.slug || slug)}`)
    } catch {
      setError('Network error — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="bevel-home-atmosphere" aria-hidden="true">
        <div className="bevel-home-mesh" />
        <div className="bevel-home-grid" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <BevelMark size="md" />
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/story">Story</Link>
          </Button>
          {status === 'authenticated' ? (
            <span className="hidden text-sm text-muted sm:inline">{email}</span>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login?callbackUrl=%2Fclaim">Sign in</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-xl px-6 pb-24 pt-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Secure your namespace
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Claim a {BEVEL_NAME} workspace
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Reserve an organization slug, bind your Google Workspace domain, and open
          channels for humans and agents. Your realtime namespace and history stay with
          the org — not a shared bag.
        </p>

        {step === 'intro' && status !== 'authenticated' ? (
          <div className="mt-10 space-y-6 rounded-2xl border border-border bg-surface/50 p-6">
            <ol className="space-y-4 text-sm text-muted">
              <li className="flex gap-3">
                <span className="font-mono text-accent">01</span>
                Sign in with Google Workspace so we know your domain.
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-accent">02</span>
                Name the organization and pick a free slug (your namespace).
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-accent">03</span>
                We provision the tenant, bind your domain, and send you to onboarding.
              </li>
            </ol>
            <Button asChild size="lg" className="w-full">
              <Link href="/login?callbackUrl=%2Fclaim">
                Continue with Google Workspace
              </Link>
            </Button>
            <p className="text-center text-xs text-muted">
              Already have a workspace?{' '}
              <Link href="/login" className="text-accent hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        ) : null}

        {(step === 'form' || status === 'authenticated') && step !== 'done' ? (
          <div className="mt-10 space-y-5 rounded-2xl border border-border bg-surface/50 p-6">
            <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-muted">
              Signed in as{' '}
              <span className="font-medium text-foreground">{email || '…'}</span>
              {emailDomain ? (
                <>
                  {' '}
                  · domain{' '}
                  <code className="font-mono text-foreground">{emailDomain}</code>
                </>
              ) : null}
            </div>

            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Organization name</span>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-accent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Robotics"
                autoFocus
              />
            </label>

            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Workspace slug</span>
              <div className="flex items-center gap-2">
                <input
                  className={cn(
                    'w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm outline-none focus:border-accent',
                  )}
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, '')
                        .slice(0, 48),
                    )
                  }}
                  placeholder="acme"
                />
              </div>
              <span className="block text-xs text-muted">
                Host preview:{' '}
                <code className="font-mono text-foreground">{hostPreview}</code>
                {' · '}
                realtime namespace <code className="font-mono text-foreground">{slug || '…'}</code>
              </span>
            </label>

            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-foreground"
              >
                {error}
              </div>
            ) : null}

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={busy || !name.trim() || !slug.trim() || status !== 'authenticated'}
              onClick={() => void claim()}
            >
              {busy ? 'Securing namespace…' : 'Claim workspace'}
            </Button>

            <p className="text-center text-[11px] leading-relaxed text-muted">
              By claiming you agree to our{' '}
              <Link href="/terms" className="text-accent hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-accent hover:underline">
                Privacy
              </Link>
              . Only claim domains and brands you control.
            </p>
          </div>
        ) : null}

        {step === 'done' ? (
          <div className="mt-10 rounded-2xl border border-border bg-surface/50 p-6 text-center">
            <p className="text-lg font-semibold text-foreground">Namespace secured</p>
            <p className="mt-2 text-sm text-muted">Taking you to onboarding…</p>
          </div>
        ) : null}

        <ul className="mt-10 grid gap-3 text-sm text-muted sm:grid-cols-3">
          {[
            { t: 'Namespace', d: 'Isolated realtime history' },
            { t: 'Domain bind', d: 'Your Google Workspace domain' },
            { t: 'Channels', d: 'Humans + agents same room' },
          ].map((x) => (
            <li
              key={x.t}
              className="rounded-xl border border-border bg-background/40 px-3 py-3"
            >
              <p className="font-semibold text-foreground">{x.t}</p>
              <p className="mt-0.5 text-xs">{x.d}</p>
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter />
    </div>
  )
}
