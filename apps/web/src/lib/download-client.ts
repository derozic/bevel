/** Which device opened /download — drives sort order and the iOS OTA CTA. */

export type DownloadClient =
  | 'iphone'
  | 'ipad'
  | 'android'
  | 'macos'
  | 'windows'
  | 'linux'
  | 'unknown'

export type DownloadSurface = 'macos' | 'ios' | 'android' | 'browser'

const SURFACE_FALLBACK: DownloadSurface[] = [
  'macos',
  'ios',
  'android',
  'browser',
]

function stripHint(value?: string | null): string {
  return (value || '').trim().replace(/^"+|"+$/g, '')
}

export function parseDownloadClient(input: {
  userAgent?: string | null
  secChUaPlatform?: string | null
  secChUaMobile?: string | null
  maxTouchPoints?: number | null
}): DownloadClient {
  const ua = (input.userAgent || '').toLowerCase()
  const platform = stripHint(input.secChUaPlatform).toLowerCase()
  const mobileHint = stripHint(input.secChUaMobile)
  const isMobileHint = mobileHint === '?1' || mobileHint === '1'
  const touch = input.maxTouchPoints ?? 0

  if (/iphone|ipod/.test(ua)) return 'iphone'
  if (/ipad/.test(ua) || (ua.includes('macintosh') && /mobile/.test(ua))) {
    return 'ipad'
  }
  if (ua.includes('android')) return 'android'
  // iPadOS 13+ desktop UA is Macintosh + multi-touch.
  if (ua.includes('macintosh') && touch > 1) return 'ipad'
  if (ua.includes('macintosh') || platform === 'macos') return 'macos'
  if (ua.includes('windows') || platform === 'windows') return 'windows'
  if ((ua.includes('linux') && !ua.includes('android')) || platform === 'linux') {
    return 'linux'
  }

  if (platform === 'ios') return isMobileHint ? 'iphone' : 'ipad'
  if (platform === 'android') return 'android'

  return 'unknown'
}

export function featuredSurface(client: DownloadClient): DownloadSurface {
  switch (client) {
    case 'iphone':
    case 'ipad':
      return 'ios'
    case 'android':
      return 'android'
    case 'macos':
      return 'macos'
    default:
      return 'browser'
  }
}

export function surfaceOrder(featured: DownloadSurface): DownloadSurface[] {
  return [featured, ...SURFACE_FALLBACK.filter((s) => s !== featured)]
}

/** Lit OTA label, or null when this client cannot install the IPA in-place. */
export function otaInstallLabel(client: DownloadClient): string | null {
  if (client === 'iphone') return 'Install on this iPhone'
  if (client === 'ipad') return 'Install on this iPad'
  return null
}

export function clientHeadline(client: DownloadClient): string {
  switch (client) {
    case 'iphone':
      return "You're on an iPhone. Install below in Safari."
    case 'ipad':
      return "You're on an iPad. Install below in Safari."
    case 'android':
      return "You're on Android. The APK is first."
    case 'macos':
      return "You're on a Mac. The signed installer is first."
    default:
      return 'Native apps for iPhone, Android, and Mac. Browser works without an install.'
  }
}
