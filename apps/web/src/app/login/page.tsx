import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
  isPlatformEntryHost,
  requireTenantFromRequest,
} from '@bevel/tenant-config'
import { isGitHubAuthConfigured, isGoogleAuthConfigured } from '@bevel/auth'
import { Button } from '@bevel/ui'
import { BevelMark } from '@/components/BevelMark'
import { auth, signIn } from '@/auth'
import { BEVEL_NAME } from '@/lib/bevel'

const ERROR_COPY: Record<string, string> = {
  Configuration:
    'Sign-in is not fully configured yet. Google OAuth credentials may be missing.',
  AccessDenied:
    'That Google Workspace account is not mapped to a BEVEL organization. Contact your admin.',
  OAuthAccountNotLinked:
    'This email is already linked to another sign-in method. Try the original provider.',
  OAuthCallback:
    'Google returned an error. Check the OAuth redirect URI includes this host.',
  OAuthSignin: 'Could not start Google sign-in. Try again in a moment.',
  Default: 'Sign-in failed. Try again, or contact your workspace admin.',
  Callback: 'Sign-in callback failed. Confirm the Google redirect URI matches this site.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  const tenant = await requireTenantFromRequest()
  const session = await auth()
  const params = await searchParams
  const errorKey = params.error ?? ''
  const errorMessage = errorKey
    ? ERROR_COPY[errorKey] ?? ERROR_COPY.Default
    : null

  const headerStore = await headers()
  const host = (
    headerStore.get('x-bevel-host') ??
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host') ??
    ''
  )
    .toLowerCase()
    .split(':')[0]
  const platformEntry = isPlatformEntryHost(host)

  // Already signed in → find org workspace (or stay if already on org host)
  if (session?.user) {
    redirect('/welcome')
  }

  const googleOk =
    (tenant.auth.providers.includes('google') || platformEntry) &&
    isGoogleAuthConfigured()
  const githubOk =
    tenant.auth.providers.includes('github') && isGitHubAuthConfigured()

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative space-y-6">
        <Link href="/" className="inline-flex items-center gap-3 text-foreground">
          <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
            <span className="text-xs font-semibold tracking-[0.2em] text-accent">
              {BEVEL_NAME.slice(0, 1)}
            </span>
          </span>
          <BevelMark size="md" />
        </Link>

        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {platformEntry ? 'Find your workspace' : `Sign in to ${tenant.name}`}
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            {platformEntry ? (
              <>
                Sign in with your Google Workspace account. We route you to your
                organization&apos;s BEVEL — channels, agents, and history — like
                opening Slack for your company.
              </>
            ) : (
              <>
                Use your organization Google account to open channels and continue
                conversations in {tenant.name}.
              </>
            )}
          </p>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-foreground"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="space-y-3 rounded-2xl border border-border bg-surface/60 p-5">
          {googleOk ? (
            <form
              action={async () => {
                'use server'
                // Always land on welcome router after Google returns
                await signIn('google', { redirectTo: '/welcome' })
              }}
            >
              <Button type="submit" size="lg" className="w-full">
                Continue with Google Workspace
              </Button>
            </form>
          ) : (
            <div className="rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-muted">
              Google sign-in is not configured on this server.
            </div>
          )}

          {githubOk ? (
            <form
              action={async () => {
                'use server'
                await signIn('github', { redirectTo: '/welcome' })
              }}
            >
              <Button type="submit" variant="outline" size="lg" className="w-full">
                Continue with GitHub
              </Button>
            </form>
          ) : null}
        </div>

        <ul className="space-y-2 text-sm text-muted">
          <li className="flex gap-2">
            <span className="text-accent">01</span>
            Google Workspace verifies who you are
          </li>
          <li className="flex gap-2">
            <span className="text-accent">02</span>
            We map your email domain to your organization
          </li>
          <li className="flex gap-2">
            <span className="text-accent">03</span>
            You open that org&apos;s channels and historical chats
          </li>
        </ul>
      </div>
    </main>
  )
}
