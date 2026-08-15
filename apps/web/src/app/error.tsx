'use client'

import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('BEVEL client error', error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Something broke in the workspace
      </h1>
      <p className="text-sm leading-relaxed text-muted">
        {error.message || 'A client-side exception stopped this screen.'}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground"
          onClick={() => reset()}
        >
          Try again
        </button>
        <a
          href="/me"
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground"
        >
          Back to Private
        </a>
      </div>
    </main>
  )
}
