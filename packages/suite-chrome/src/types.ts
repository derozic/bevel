/** Contract for GET /api/suite/launch — keep in sync with apps/web route. */

export type BevelSuiteLaunch = {
  ok: boolean
  signedIn: boolean
  workspace?: { host: string; label: string }
  unreadCount: number
  primaryHref: string
  primaryLabel: string
  latest: {
    id?: string | null
    channelSlug?: string | null
    actorLabel?: string | null
    bodyPreview?: string | null
    createdAt?: string | null
    href: string
    kind?: string | null
  } | null
  starts?: Array<{ label: string; href: string }>
}
