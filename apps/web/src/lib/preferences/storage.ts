import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  type BevelUserPreferences,
} from '@bevel/schema'

export function preferencesStorageKey(
  tenantSlug: string,
  userId: string,
): string {
  return `bevel.prefs.${tenantSlug || 'default'}.${userId || 'anon'}`
}

export function loadPreferences(
  tenantSlug: string,
  userId: string,
): BevelUserPreferences {
  if (typeof window === 'undefined') return structuredClone(DEFAULT_PREFERENCES)
  try {
    const raw = window.localStorage.getItem(
      preferencesStorageKey(tenantSlug, userId),
    )
    if (!raw) return structuredClone(DEFAULT_PREFERENCES)
    return parsePreferences(JSON.parse(raw))
  } catch {
    return structuredClone(DEFAULT_PREFERENCES)
  }
}

export function savePreferences(
  tenantSlug: string,
  userId: string,
  prefs: BevelUserPreferences,
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      preferencesStorageKey(tenantSlug, userId),
      JSON.stringify(prefs),
    )
  } catch {
    // quota / private mode
  }
}

export function patchPreferences(
  tenantSlug: string,
  userId: string,
  patch: (current: BevelUserPreferences) => BevelUserPreferences,
): BevelUserPreferences {
  const next = patch(loadPreferences(tenantSlug, userId))
  const parsed = parsePreferences(next)
  savePreferences(tenantSlug, userId, parsed)
  return parsed
}
