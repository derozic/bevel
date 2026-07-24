'use client'

import { useDaypart } from './daypart-provider'

/** Compact daypart chip for the console header. */
export function DayNightBadge() {
  const { daypart } = useDaypart()
  return (
    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      {daypart}
    </span>
  )
}
