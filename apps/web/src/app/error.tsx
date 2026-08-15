'use client'

import { FleetHailScreen } from '@/components/error/FleetHailScreen'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <FleetHailScreen
      variant="crash"
      error={error}
      onReset={reset}
      homeHref="/me"
      homeLabel="Private"
    />
  )
}
