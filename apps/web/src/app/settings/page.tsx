'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { usePreferencesOptional } from '@/components/preferences/PreferencesProvider'
import type { PreferencesSectionId } from '@/components/preferences/PreferencesProvider'
import { BEVEL_HOME_PATH } from '@/lib/bevel'

const SECTIONS: PreferencesSectionId[] = [
  'ai',
  'profile',
  'account',
  'availability',
  'notifications',
  'vip',
  'navigation',
  'home',
  'appearance',
  'messages',
  'language',
  'accessibility',
  'markAsRead',
  'media',
  'integrations',
  'privacy',
  'security',
]

function SettingsOpener() {
  const router = useRouter()
  const search = useSearchParams()
  const { status } = useSession()
  const prefs = usePreferencesOptional()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?callbackUrl=${encodeURIComponent('/settings')}`)
      return
    }
    if (status !== 'authenticated' || !prefs) return

    const raw = search.get('section') ?? 'ai'
    const section = SECTIONS.includes(raw as PreferencesSectionId)
      ? (raw as PreferencesSectionId)
      : 'ai'
    prefs.openSection(section)
    router.replace(BEVEL_HOME_PATH)
  }, [status, prefs, router, search])

  return (
    <main className="flex min-h-screen items-center justify-center text-sm text-muted">
      Opening preferences…
    </main>
  )
}

/**
 * Deep link into Preferences dialog, then return to workspace.
 * /settings?section=ai | profile | media | integrations | privacy | …
 */
export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-muted">
          Opening preferences…
        </main>
      }
    >
      <SettingsOpener />
    </Suspense>
  )
}
