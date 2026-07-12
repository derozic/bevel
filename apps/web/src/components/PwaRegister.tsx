'use client'

import { useEffect } from 'react'
import { registerBevelServiceWorker } from '@/lib/bevel-notify'

/** Registers the BEVEL service worker once on the client (PWA + notifications). */
export function PwaRegister() {
  useEffect(() => {
    void registerBevelServiceWorker()
  }, [])
  return null
}
