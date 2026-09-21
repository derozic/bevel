'use client'

import { useEffect, useState } from 'react'
import { DeviceTabletIcon } from '@heroicons/react/24/outline'
import {
  isAppleMobileUserAgent,
  nativeAppUrlFromLocation,
} from '@/lib/native-app-url'

/**
 * Safari on iPhone / iPad: open the current conversation in the native app.
 * Hidden inside the Flutter WebView (BevelNative UA).
 */
export function OpenInBevelApp() {
  const [href, setHref] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (
      !isAppleMobileUserAgent(
        window.navigator.userAgent,
        window.navigator.maxTouchPoints,
      )
    ) {
      return
    }
    if (document.documentElement.getAttribute('data-bevel-native') === '1') {
      return
    }
    setHref(nativeAppUrlFromLocation(window.location.href))
  }, [])

  if (!href) return null

  return (
    <a
      href={href}
      className="fixed bottom-4 right-4 z-[80] inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/20"
    >
      <DeviceTabletIcon className="size-4" aria-hidden />
      Open in BEVEL
    </a>
  )
}
