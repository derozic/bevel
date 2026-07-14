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
  type BevelUserPreferences,
} from '@bevel/schema'
import { loadPreferences, savePreferences } from '@/lib/preferences/storage'
import {
  getNotificationPermission,
  queryMediaPermission,
} from '@/lib/preferences/permissions'
import { applyDaypartAtmosphere } from '@/lib/daypart'

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

/** Debounced persistence — insurance if the user never hits Update. */
const AUTOSAVE_MS = 900

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

  const persist = useCallback(
    (value: BevelUserPreferences, source: 'auto' | 'manual') => {
      try {
        savePreferences(tenantSlug, userId, value)
        const at = Date.now()
        setLastSavedAt(at)
        setDirty(false)
        setSaveStatus('saved')
        if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current)
        // Manual Update keeps "Saved" a bit longer so the CTA feels conclusive
        const flashMs = source === 'manual' ? 2200 : 1600
        savedFlashTimer.current = setTimeout(() => {
          setSaveStatus((s) => (s === 'saved' ? 'idle' : s))
        }, flashMs)
      } catch {
        setSaveStatus('error')
      }
    },
    [tenantSlug, userId],
  )

  const scheduleAutosave = useCallback(() => {
    if (!hydrated.current) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null
      setSaveStatus('saving')
      persist(prefsRef.current, 'auto')
    }, AUTOSAVE_MS)
  }, [persist])

  const saveNow = useCallback(() => {
    if (!hydrated.current) return
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current)
      autosaveTimer.current = null
    }
    setSaveStatus('saving')
    persist(prefsRef.current, 'manual')
  }, [persist])

  // Load when identity is known
  useEffect(() => {
    hydrated.current = false
    clearTimers()
    const loaded = loadPreferences(tenantSlug, userId)
    setPrefsState(loaded)
    prefsRef.current = loaded
    setSaveStatus('idle')
    setDirty(false)
    setLastSavedAt(null)
    const t = window.setTimeout(() => {
      hydrated.current = true
    }, 0)
    return () => {
      window.clearTimeout(t)
      clearTimers()
    }
  }, [tenantSlug, userId, clearTimers])

  const setPrefs = useCallback(
    (
      next:
        | BevelUserPreferences
        | ((prev: BevelUserPreferences) => BevelUserPreferences),
    ) => {
      setPrefsState((prev) => {
        const value = typeof next === 'function' ? next(prev) : next
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
        persist(prefsRef.current, 'auto')
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
    root.dataset.bevelDensity = prefs.appearance.density
    root.style.setProperty(
      '--bevel-ui-zoom',
      `${prefs.accessibility.zoomPercent / 100}`,
    )
    if (prefs.accessibility.simplifiedLayout) {
      root.dataset.bevelSimplified = 'true'
    } else {
      delete root.dataset.bevelSimplified
    }
  }, [
    prefs.appearance.density,
    prefs.accessibility.zoomPercent,
    prefs.accessibility.simplifiedLayout,
  ])

  /**
   * Theme + daypart (useLayoutEffect so HC wins before paint).
   * Body often carries tenant SSR inline tokens; those beat html CSS vars,
   * so we strip atmosphere keys from body whenever daypart/HC runs.
   */
  useLayoutEffect(() => {
    const root = document.documentElement
    const themeId = prefs.appearance.themeId ?? 'tenant'
    let daypartPref = prefs.appearance.daypart ?? 'auto'

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
  }, [prefs.appearance.daypart, prefs.appearance.themeId])

  // Auto daypart clock tick (only when not locked by system theme)
  useEffect(() => {
    if (prefs.appearance.themeId === 'system') return
    if (prefs.appearance.themeId === 'high_contrast') {
      const pref = prefs.appearance.daypart ?? 'auto'
      if (pref !== 'auto') return
      const timer = window.setInterval(() => {
        applyDaypartAtmosphere('auto')
        document.documentElement.dataset.bevelContrast = 'high'
      }, 60_000)
      return () => window.clearInterval(timer)
    }
    const pref = prefs.appearance.daypart ?? 'auto'
    if (pref !== 'auto') return
    const timer = window.setInterval(() => {
      applyDaypartAtmosphere('auto')
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [prefs.appearance.daypart, prefs.appearance.themeId])

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
