'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Daypart } from './daypart'

type Ctx = {
  daypart: Daypart
  setDaypart: (d: Daypart) => void
  useAuto: boolean
  setUseAuto: (v: boolean) => void
}

const DaypartContext = createContext<Ctx | null>(null)

export function DaypartProvider({ children }: { children: ReactNode }) {
  const [daypart, setDaypart] = useState<Daypart>('day')
  const [useAuto, setUseAuto] = useState(true)
  const value = useMemo(
    () => ({ daypart, setDaypart, useAuto, setUseAuto }),
    [daypart, useAuto],
  )
  return <DaypartContext.Provider value={value}>{children}</DaypartContext.Provider>
}

export function useDaypart(): Ctx {
  const ctx = useContext(DaypartContext)
  if (!ctx) {
    return {
      daypart: 'day',
      setDaypart: () => {},
      useAuto: true,
      setUseAuto: () => {},
    }
  }
  return ctx
}
