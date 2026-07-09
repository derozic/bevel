export default function RealtimePage() {
  const url = process.env.REALTIME_URL ?? 'https://realtime.bevel.lvh.me'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Realtime transport</h1>
        <p className="mt-1 text-sm text-[var(--bevel-text-muted)]">
          Colyseus namespace per tenant — separate from the Next.js app layer.
        </p>
      </div>
      <section className="rounded-xl border border-[var(--bevel-border)] bg-[var(--bevel-surface)] p-6">
        <p className="text-sm text-[var(--bevel-text-muted)]">Public URL</p>
        <p className="mt-2 font-mono text-sm">{url}</p>
        <p className="mt-4 text-sm text-[var(--bevel-text-muted)]">
          Service: <code className="font-mono text-xs">services/realtime</code>
        </p>
      </section>
    </div>
  )
}