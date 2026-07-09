import { requireTenantFromRequest } from '@bevel/tenant-config'
import { signIn } from '@/auth'

export default async function LoginPage() {
  const tenant = await requireTenantFromRequest()

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Sign in to {tenant.name}</h1>
        <p className="text-sm text-[var(--bevel-text-muted)]">
          Use your organization account to access channels and agents.
        </p>
      </div>
      <form
        action={async () => {
          'use server'
          await signIn('google', { redirectTo: '/bevel' })
        }}
      >
        {tenant.auth.providers.includes('google') ? (
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--bevel-accent)] px-4 py-3 text-sm font-medium text-white hover:opacity-90"
          >
            Continue with Google
          </button>
        ) : null}
      </form>
      {tenant.auth.providers.includes('github') ? (
        <form
          action={async () => {
            'use server'
            await signIn('github', { redirectTo: '/bevel' })
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg border border-[var(--bevel-border)] px-4 py-3 text-sm font-medium hover:bg-white/5"
          >
            Continue with GitHub
          </button>
        </form>
      ) : null}
    </main>
  )
}