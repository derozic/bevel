'use client'

import type { DaypartPreference } from '@bevel/schema'
import { usePreferencesOptional } from '@/components/preferences/PreferencesProvider'
import {
  DAYPART_META,
  DAYPART_ORDER,
  resolveDaypart,
} from '@/lib/daypart'

const OPTIONS: { id: DaypartPreference; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  ...DAYPART_ORDER.map((id) => ({
    id,
    label: DAYPART_META[id].shortLabel,
  })),
]

/** Compact day-part switcher for the rail footer — Auto is default. */
export function DaypartControl({ className }: { className?: string }) {
  const prefs = usePreferencesOptional()
  if (!prefs) return null

  const preference = prefs.prefs.appearance.daypart ?? 'auto'
  const resolved = resolveDaypart(preference)
  const meta = DAYPART_META[resolved]

  return (
    <div className={className ? `bevel-daypart-control ${className}` : 'bevel-daypart-control'}>
      <p className="bevel-daypart-control__label">Day part</p>
      <div className="bevel-daypart-control__row" role="group" aria-label="Day part">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="bevel-daypart-control__chip"
            data-active={preference === opt.id ? 'true' : 'false'}
            title={
              opt.id === 'auto'
                ? `Auto · currently ${meta.label}`
                : `${DAYPART_META[opt.id as keyof typeof DAYPART_META].label} · ${DAYPART_META[opt.id as keyof typeof DAYPART_META].hours}`
            }
            onClick={() =>
              prefs.updatePrefs({ appearance: { daypart: opt.id } })
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="bevel-daypart-control__meta">
        {preference === 'auto' ? `Auto · ${meta.label}` : meta.label}
        {' · '}
        {meta.greeting}
      </p>
    </div>
  )
}
