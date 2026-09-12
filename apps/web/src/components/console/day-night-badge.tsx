'use client'

import { useEffect, useState } from 'react'
import {
  ClockIcon,
  MoonIcon,
  SparklesIcon,
  SunIcon,
} from '@heroicons/react/24/outline'
import { SunIcon as SunSolidIcon } from '@heroicons/react/24/solid'
import type { DaypartPreference } from '@bevel/schema'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@bevel/ui'
import { usePreferencesOptional } from '@/components/preferences/PreferencesProvider'
import {
  DAYPART_META,
  DAYPART_ORDER,
  resolveDaypart,
  type DaypartId,
} from '@/lib/daypart'

function Glyph({
  part,
  className = 'h-3.5 w-3.5 shrink-0 opacity-80',
}: {
  part: DaypartId | 'auto'
  className?: string
}) {
  if (part === 'auto') return <ClockIcon className={className} aria-hidden />
  if (part === 'morning') return <SunIcon className={className} aria-hidden />
  if (part === 'midday') return <SunSolidIcon className={className} aria-hidden />
  if (part === 'afternoon') {
    return <SparklesIcon className={className} aria-hidden />
  }
  return <MoonIcon className={className} aria-hidden />
}

/**
 * Console header chip. Reads the workspace day-part on <html>, not the
 * leftover dawn/day/dusk flag that always said "DAY" on a navy screen.
 */
export function DayNightBadge() {
  const prefs = usePreferencesOptional()
  const [domPart, setDomPart] = useState<DaypartId | null>(null)

  useEffect(() => {
    const root = document.documentElement
    const read = () => {
      const raw = root.getAttribute('data-daypart') as DaypartId | null
      if (raw && DAYPART_ORDER.includes(raw)) setDomPart(raw)
    }
    read()
    const mo = new MutationObserver(read)
    mo.observe(root, { attributes: true, attributeFilter: ['data-daypart'] })
    return () => mo.disconnect()
  }, [])

  const preference = prefs?.prefs.appearance.daypart ?? 'auto'
  const resolved = domPart ?? resolveDaypart(preference)
  const meta = DAYPART_META[resolved]
  const label =
    preference === 'auto' ? `Auto · ${meta.label}` : meta.label

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted hover:text-foreground"
          title={`${meta.label} · ${meta.hours}${preference === 'auto' ? ' (auto)' : ''}`}
          aria-label={`Day part: ${label}`}
        >
          <Glyph part={resolved} className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          {preference === 'auto' ? (
            <>
              Auto
              <span className="font-medium normal-case tracking-normal text-muted">
                {meta.shortLabel}
              </span>
            </>
          ) : (
            meta.label
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[5000] min-w-[11.5rem]">
        <DropdownMenuLabel>Day part</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(v) =>
            prefs?.updatePrefs({
              appearance: { daypart: v as DaypartPreference },
            })
          }
        >
          <DropdownMenuRadioItem value="auto">
            <Glyph part="auto" />
            Auto
            <span className="ml-auto text-[10px] text-muted">{meta.shortLabel}</span>
          </DropdownMenuRadioItem>
          {DAYPART_ORDER.map((id) => (
            <DropdownMenuRadioItem
              key={id}
              value={id}
              title={DAYPART_META[id].hours}
            >
              <Glyph part={id} />
              {DAYPART_META[id].label}
              <span className="ml-auto text-[10px] text-muted">
                {DAYPART_META[id].hours}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
