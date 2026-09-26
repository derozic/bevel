'use client'

import { DaypartControl } from '@/components/DaypartControl'

/** Four day-parts + Auto, persisted through the same prefs as the rest of BEVEL. */
export function LoginDaypartBar() {
  return <DaypartControl compact />
}
