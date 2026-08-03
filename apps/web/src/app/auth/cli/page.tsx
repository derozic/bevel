import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@bevel/ui'
import { auth } from '@/auth'

/**
 * CLI permission bridge — settings + palette link here.
 * Full device-code flow can land later; for now document sync path.
 */
export default async function AuthCliPage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=%2Fauth%2Fcli')
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Command-line
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          CLI permission
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Signed in as{' '}
          <span className="font-medium text-foreground">{session.user.email}</span>.
          Provider keys saved in console settings are stored on your BEVEL
          account. Pull them into a local CLI with:
        </p>
      </div>

      <pre className="overflow-x-auto rounded-xl border border-border bg-surface p-4 text-sm text-foreground">
        {`bevel auth sync --pull
bevel ai ask "hello"`}
      </pre>

      <p className="text-xs text-muted">
        Device-code pairing for headless machines will land here next. Until
        then, use browser sign-in +{' '}
        <code className="rounded bg-surface px-1">bevel auth sync --pull</code>.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="sm">
          <Link href="/console/settings">Back to settings</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/console">Console</Link>
        </Button>
      </div>
    </main>
  )
}
