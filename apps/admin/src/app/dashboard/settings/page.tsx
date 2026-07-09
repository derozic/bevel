export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-[var(--bevel-text-muted)]">
          Platform defaults and operator preferences.
        </p>
      </div>
      <section className="rounded-xl border border-[var(--bevel-border)] bg-[var(--bevel-surface)] p-6 text-sm text-[var(--bevel-text-muted)]">
        OAuth credentials and CNAME target are configured via environment variables. See{' '}
        <code className="font-mono text-xs">.env.example</code> in the repo root.
      </section>
    </div>
  )
}