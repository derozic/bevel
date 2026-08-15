'use client'

import { FleetHailScreen } from '@/components/error/FleetHailScreen'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#081018' }}>
        <FleetHailScreen
          variant="fatal"
          error={error}
          onReset={reset}
          homeHref="/login?clear=1"
          homeLabel="Clear session"
        />
      </body>
    </html>
  )
}
