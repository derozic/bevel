export const CONVERSATION_PIN_KINDS = ['channel', 'talk', 'session'] as const

export type ConversationPinKind = (typeof CONVERSATION_PIN_KINDS)[number]

export type ConversationPin = {
  kind: ConversationPinKind
  id: string
}

export function pinKey(pin: ConversationPin): string {
  return `${pin.kind}:${pin.id.trim().toLowerCase()}`
}

export function samePin(a: ConversationPin, b: ConversationPin): boolean {
  return pinKey(a) === pinKey(b)
}

export function hasPin(list: ConversationPin[], pin: ConversationPin): boolean {
  const key = pinKey(pin)
  return list.some((item) => pinKey(item) === key)
}

export function togglePin(
  list: ConversationPin[],
  pin: ConversationPin,
): ConversationPin[] {
  const key = pinKey(pin)
  if (list.some((item) => pinKey(item) === key)) {
    return list.filter((item) => pinKey(item) !== key)
  }
  const id = pin.id.trim().toLowerCase()
  if (!id) return list
  return [...list, { kind: pin.kind, id }]
}

export function defaultChannelPins(slugs: string[]): ConversationPin[] {
  const seen = new Set<string>()
  const out: ConversationPin[] = []
  for (const raw of slugs) {
    const id = raw.trim().toLowerCase()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({ kind: 'channel', id })
  }
  return out
}

/**
 * Stored `undefined` means the member has not customized pins yet —
 * fall back to workspace tracks so the grid is not empty on first load.
 * An explicit `[]` is "unpinned everything".
 */
export function resolvePins(
  stored: ConversationPin[] | undefined,
  fallbackChannelSlugs: string[],
): { pins: ConversationPin[]; usingDefaults: boolean } {
  if (stored === undefined) {
    return {
      pins: defaultChannelPins(fallbackChannelSlugs),
      usingDefaults: true,
    }
  }
  return { pins: stored, usingDefaults: false }
}
