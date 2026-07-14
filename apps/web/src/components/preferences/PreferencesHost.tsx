'use client'

import { PreferencesProvider } from './PreferencesProvider'
import { PreferencesPanel } from './PreferencesPanel'
import type { ReactNode } from 'react'

/** Mount once under AuthProvider — right prefs panel + Cmd+, globally. */
export function PreferencesHost({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      {children}
      <PreferencesPanel />
    </PreferencesProvider>
  )
}
