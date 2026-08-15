'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSession } from 'next-auth/react'
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  type BevelUserPreferences,
} from '@bevel/schema'
import { loadPreferences, savePreferences } from '@/lib/preferences/storage'
import {
  getNotificationPermission,
  queryMediaPermission,
} from '@/lib/preferences/permissions'
import { applyDaypartAtmosphere } from '@/lib/daypart'

/** Never let partial/corrupt prefs crash the app tree. */
function safePrefs(input: unknown): BevelUserPreferences {
  try {
    return parsePreferences(input)
  } catch {
    return structuredClone(DEFAULT_PREFERENCES)
  }
}

export type PreferencesSectionId =
  | 'ai'
  | 'profile'
  | 'account'
  | 'availability'
  | 'notifications'
  | 'vip'
  | 'navigation'
  | 'home'
  | 'appearance'
  | 'messages'
  | 'language'
  | 'accessibility'
  | 'markAsRead'
  | 'media'
  | 'integrations'
  | 'privacy'
  | 'security'

/** Save feedback for the prefs shell (Update + autosave + ⌘S). */
export type PreferencesSaveStatus =
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'error'

/**
 * Server autosave only after the user pauses typing — not per keystroke.
 * LocalStorage cache updates immediately (silent); network waits for idle.
 */
const AUTOSAVE_MS = 2800

type PreferencesContextValue = {
  open: boolean
  section: PreferencesSectionId
  prefs: BevelUserPreferences
  /** dirty | saving | saved | error | idle */
  saveStatus: PreferencesSaveStatus
  /** True when in-memory prefs differ from last successful write. */
  dirty: boolean
  lastSavedAt: number | null
  setOpen: (open: boolean) => void
  openSection: (section: PreferencesSectionId) => void
  setPrefs: (
    next:
      | BevelUserPreferences
      | ((prev: BevelUserPreferences) => BevelUserPreferences),
  ) => void
  updatePrefs: (patch: PartialDeepPrefs) => void
  /** Explicit save (Update button / ⌘S). Flushes pending autosave immediately. */
  saveNow: () => void
  refreshPermissions: () => Promise<void>
}

type PartialDeepPrefs = {
  [K in keyof BevelUserPreferences]?: Partial<BevelUserPreferences[K]>
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const tenantSlug = session?.tenantSlug ?? 'default'
  const userId = session?.user?.id ?? session?.user?.email ?? 'anon'

  const [open, setOpenState] = useState(false)
  const [section, setSection] = useState<PreferencesSectionId>('ai')
  const [prefs, setPrefsState] = useState<BevelUserPreferences>(() =>
    structuredClone(DEFAULT_PREFERENCES),
  )
  const [saveStatus, setSaveStatus] = useState<PreferencesSaveStatus>('idle')
  const [dirty, setDirty] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Skip dirty/autosave on the initial load from storage
  const hydrated = useRef(false)
  /** Monotonic id so only the latest in-flight server save can commit UI state. */
  const saveGen = useRef(0)
  const inFlight = useRef(false)
  const pendingAfterFlight = useRef(false)

  const clearTimers = useCallback(() => {
    if (savedFlashTimer.current) {
      clearTimeout(savedFlashTimer.current)
      savedFlashTimer.current = null
    }
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current)
      autosaveTimer.current = null
    }
  }, [])

  const writeLocalCache = useCallback(
    (value: BevelUserPreferences) => {
      try {
        savePreferences(tenantSlug, userId, value)
      } catch {
        /* quota / private mode */
      }
    },
    [tenantSlug, userId],
  )

  const persist = useCallback(
    async (value: BevelUserPreferences, source: 'auto' | 'manual') => {
      writeLocalCache(value)

      // Coalesce: one network write at a time; queue one more for the latest value
      if (inFlight.current) {
        pendingAfterFlight.current = true
        return
      }

      const gen = ++saveGen.current
      inFlight.current = true
      // Only flash "Saving…" for explicit Save / ⌘S — not while typing
      if (source === 'manual') {
        setSaveStatus('saving')
      }

      try {
        const res = await fetch('/api/me/settings', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preferences: value,
            merge: true,
            tenantId: tenantSlug || undefined,
          }),
        })
        if (!res.ok) {
          const profile = value.profile
          const fallback = await fetch('/api/me/profile', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              handle: profile?.handle || undefined,
              name: profile?.displayName || undefined,
              imageUrl: profile?.photoUrl || undefined,
              personalAgentId: profile?.personalAgentId || undefined,
              profile: profile || undefined,
              preferences: value,
              tenantId: tenantSlug || undefined,
            }),
          }).catch(() => null)
          if (!fallback?.ok) {
            if (gen === saveGen.current) setSaveStatus('error')
            return
          }
        }
        // Stale response (newer edit started) — ignore UI success
        if (gen !== saveGen.current) return

        const at = Date.now()
        setLastSavedAt(at)
        setDirty(false)
        setSaveStatus('saved')
        if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current)
        const flashMs = source === 'manual' ? 2200 : 1400
        savedFlashTimer.current = setTimeout(() => {
          setSaveStatus((s) => (s === 'saved' ? 'idle' : s))
        }, flashMs)
      } catch {
        if (gen === saveGen.current) setSaveStatus('error')
      } finally {
        inFlight.current = false
        if (pendingAfterFlight.current && gen === saveGen.current) {
          pendingAfterFlight.current = false
          // One more write with whatever is current after the pause
          void persist(prefsRef.current, source)
        } else {
          pendingAfterFlight.current = false
        }
      }
    },
    [tenantSlug, userId, writeLocalCache],
  )

  const scheduleAutosave = useCallback(() => {
    if (!hydrated.current) return
    // Immediate silent local cache; server only after idle
    writeLocalCache(prefsRef.current)
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null
      // Stay on "dirty" until network finishes — never "saving" per keystroke
      void persist(prefsRef.current, 'auto')
    }, AUTOSAVE_MS)
  }, [persist, writeLocalCache])

  const saveNow = useCallback(() => {
    if (!hydrated.current) return
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current)
      autosaveTimer.current = null
    }
    void persist(prefsRef.current, 'manual')
  }, [persist])

  // Load when identity is known — server (Postgres) is source of truth when signed in
  useEffect(() => {
    let cancelled = false
    hydrated.current = false
    clearTimers()
    setSaveStatus('idle')
    setDirty(false)
    setLastSavedAt(null)

    // Paint local cache immediately, then overlay server prefs
    let local: BevelUserPreferences
    try {
      local = safePrefs(loadPreferences(tenantSlug, userId))
    } catch {
      local = structuredClone(DEFAULT_PREFERENCES)
    }
    setPrefsState(local)
    prefsRef.current = local

    const isAnon = !userId || userId === 'anon'
    if (isAnon) {
      const t = window.setTimeout(() => {
        if (!cancelled) hydrated.current = true
      }, 0)
      return () => {
        cancelled = true
        window.clearTimeout(t)
        clearTimers()
      }
    }

    void (async () => {
      try {
        const res = await fetch('/api/me/settings', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok || cancelled) {
          if (!cancelled) hydrated.current = true
          return
        }
        const data = (await res.json().catch(() => ({}))) as {
          preferences?: BevelUserPreferences | Record<string, unknown>
          updatedAt?: string | null
        }
        if (cancelled) return
        if (data.preferences && typeof data.preferences === 'object') {
          const server = data.preferences as Record<string, unknown>
          const serverProfile =
            server.profile && typeof server.profile === 'object'
              ? (server.profile as Record<string, unknown>)
              : {}
          const merged = safePrefs({
            ...local,
            ...server,
            profile: {
              ...local.profile,
              ...serverProfile,
            },
          })
          setPrefsState(merged)
          prefsRef.current = merged
          writeLocalCache(merged)
          if (data.updatedAt) {
            const ts = Date.parse(data.updatedAt)
            if (!Number.isNaN(ts)) setLastSavedAt(ts)
          }
        }
      } catch {
        /* offline / corrupt — keep local */
      } finally {
        if (!cancelled) hydrated.current = true
      }
    })()

    return () => {
      cancelled = true
      clearTimers()
    }
  }, [tenantSlug, userId, clearTimers, writeLocalCache])

  const setPrefs = useCallback(
    (
      next:
        | BevelUserPreferences
        | ((prev: BevelUserPreferences) => BevelUserPreferences),
    ) => {
      setPrefsState((prev) => {
        const raw = typeof next === 'function' ? next(prev) : next
        const value = safePrefs(raw)
        prefsRef.current = value
        if (hydrated.current) {
          setDirty(true)
          setSaveStatus('dirty')
          scheduleAutosave()
        }
        return value
      })
    },
    [scheduleAutosave],
  )

  const updatePrefs = useCallback(
    (patch: PartialDeepPrefs) => {
      setPrefs((prev) => {
        const next = { ...prev }
        for (const key of Object.keys(patch) as (keyof BevelUserPreferences)[]) {
          const partial = patch[key]
          if (!partial || typeof partial !== 'object') continue
          if (key === 'ai') {
            const aiPatch = partial as Partial<BevelUserPreferences['ai']>
            next.ai = {
              ...prev.ai,
              ...aiPatch,
              providers: {
                ...prev.ai.providers,
                ...(aiPatch.providers ?? {}),
              },
              custom: {
                ...prev.ai.custom,
                ...(aiPatch.custom ?? {}),
              },
              ollama: {
                ...prev.ai.ollama,
                ...(aiPatch.ollama ?? {}),
              },
            }
            continue
          }
          // @ts-expect-error deep partial assign
          next[key] = { ...prev[key], ...partial }
        }
        return next
      })
    },
    [setPrefs],
  )

  const refreshPermissions = useCallback(async () => {
    const desktop = getNotificationPermission()
    const camera = await queryMediaPermission('camera')
    const mic = await queryMediaPermission('microphone')
    setPrefs((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        desktopEnabled:
          desktop === 'granted'
            ? true
            : desktop === 'denied'
              ? false
              : prev.notifications.desktopEnabled,
      },
      media: {
        ...prev.media,
        cameraPermission: camera,
        microphonePermission: mic,
      },
    }))
  }, [setPrefs])

  const setOpen = useCallback(
    (next: boolean) => {
      // Flush pending edits when closing so nothing is left only in memory
      if (!next && hydrated.current && (dirty || autosaveTimer.current)) {
        if (autosaveTimer.current) {
          clearTimeout(autosaveTimer.current)
          autosaveTimer.current = null
        }
        void persist(prefsRef.current, 'auto')
      }
      setOpenState(next)
    },
    [dirty, persist],
  )

  useEffect(() => {
    if (!open) return
    void refreshPermissions()
  }, [open, refreshPermissions])

  // ⌘, open · ⌘S save while prefs open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setOpen(true)
        return
      }
      if (!open) return
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        saveNow()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, saveNow, setOpen])

  // Density, zoom, simplified layout
  useEffect(() => {
    const root = document.documentElement
    const appearance = prefs?.appearance
    const accessibility = prefs?.accessibility
    if (!appearance || !accessibility) return
    root.dataset.bevelDensity = appearance.density
    const zoomPercent = accessibility.zoomPercent ?? 100
    // Do not set zoom:1 — iOS Safari still engages the zoom compositor and flickers.
    if (zoomPercent !== 100) {
      root.style.setProperty('--bevel-ui-zoom', `${zoomPercent / 100}`)
      root.dataset.bevelZoom = 'true'
    } else {
      root.style.removeProperty('--bevel-ui-zoom')
      delete root.dataset.bevelZoom
    }
    if (accessibility.simplifiedLayout) {
      root.dataset.bevelSimplified = 'true'
    } else {
      delete root.dataset.bevelSimplified
    }
  }, [
    prefs?.appearance?.density,
    prefs?.accessibility?.zoomPercent,
    prefs?.accessibility?.simplifiedLayout,
  ])

  /**
   * Theme + daypart (useLayoutEffect so HC wins before paint).
   * Body often carries tenant SSR inline tokens; those beat html CSS vars,
   * so we strip atmosphere keys from body whenever daypart/HC runs.
   */
  useLayoutEffect(() => {
    const root = document.documentElement
    const themeId = prefs?.appearance?.themeId ?? 'tenant'
    let daypartPref = prefs?.appearance?.daypart ?? 'auto'

    if (themeId === 'system') {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
      daypartPref = dark ? 'night' : 'midday'
      root.dataset.bevelTheme = 'system'
    } else if (themeId === 'high_contrast') {
      root.dataset.bevelTheme = 'high_contrast'
    } else {
      root.dataset.bevelTheme = 'tenant'
    }

    applyDaypartAtmosphere(daypartPref)

    if (themeId === 'high_contrast') {
      root.dataset.bevelContrast = 'high'
    } else {
      delete root.dataset.bevelContrast
    }

    const stripBodyAtmosphere = () => {
      const body = document.body
      if (!body) return
      for (const key of [
        '--cream',
        '--ink',
        '--surface',
        '--border',
        '--sticker-muted',
        '--sticker-subtle',
        '--bevel-bg',
        '--bevel-surface',
        '--bevel-surface-raised',
        '--bevel-text',
        '--bevel-text-muted',
        '--bevel-border',
        '--bevel-accent',
        '--bevel-accent-muted',
        '--command-accent',
      ]) {
        body.style.removeProperty(key)
      }
    }
    stripBodyAtmosphere()
    const raf = window.requestAnimationFrame(stripBodyAtmosphere)

    if (themeId !== 'system') {
      return () => window.cancelAnimationFrame(raf)
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      applyDaypartAtmosphere(mq.matches ? 'night' : 'midday')
      stripBodyAtmosphere()
    }
    mq.addEventListener('change', onChange)
    return () => {
      window.cancelAnimationFrame(raf)
      mq.removeEventListener('change', onChange)
    }
  }, [prefs?.appearance?.daypart, prefs?.appearance?.themeId])

  // Auto daypart clock tick (only when not locked by system theme)
  useEffect(() => {
    const themeId = prefs?.appearance?.themeId
    if (!themeId || themeId === 'system') return
    if (themeId === 'high_contrast') {
      const pref = prefs?.appearance?.daypart ?? 'auto'
      if (pref !== 'auto') return
      const timer = window.setInterval(() => {
        applyDaypartAtmosphere('auto')
        document.documentElement.dataset.bevelContrast = 'high'
      }, 60_000)
      return () => window.clearInterval(timer)
    }
    const pref = prefs?.appearance?.daypart ?? 'auto'
    if (pref !== 'auto') return
    const timer = window.setInterval(() => {
      applyDaypartAtmosphere('auto')
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [prefs?.appearance?.daypart, prefs?.appearance?.themeId])

  const openSection = useCallback((s: PreferencesSectionId) => {
    setSection(s)
    setOpenState(true)
  }, [])

  const value = useMemo(
    () => ({
      open,
      section,
      prefs,
      saveStatus,
      dirty,
      lastSavedAt,
      setOpen,
      openSection,
      setPrefs,
      updatePrefs,
      saveNow,
      refreshPermissions,
    }),
    [
      open,
      section,
      prefs,
      saveStatus,
      dirty,
      lastSavedAt,
      setOpen,
      openSection,
      setPrefs,
      updatePrefs,
      saveNow,
      refreshPermissions,
    ],
  )

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) {
    throw new Error('usePreferences must be used within PreferencesProvider')
  }
  return ctx
}

export function usePreferencesOptional(): PreferencesContextValue | null {
  return useContext(PreferencesContext)
}
