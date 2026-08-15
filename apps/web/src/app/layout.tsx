import type { Metadata, Viewport } from 'next'
import type { CSSProperties, ReactNode } from 'react'
import { getTenantFromRequest, tenantThemeCssVars } from '@bevel/tenant-config'
import { AuthProvider } from '@bevel/auth/client'
import { PreferencesHost } from '@/components/preferences/PreferencesHost'
import { PwaRegister } from '@/components/PwaRegister'
import { MagentaAnalytics } from '@/components/MagentaAnalytics'
import { CommandPaletteProvider } from '@/components/console/command-palette'
import { DaypartProvider } from '@/components/console/daypart-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'BEVEL™',
  description: 'Open channels for humans and agents.',
}

/** Keyboard resizes layout instead of overlaying it — avoids 100dvh flicker on iPad. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const tenant = await getTenantFromRequest()
  const themeAttr = tenant?.slug ?? 'default'
  const themeStyle = tenantThemeCssVars(tenant) as CSSProperties
  const productName = (tenant?.theme.productName ?? tenant?.name ?? undefined)
    ?.replace(/\s+Agents$/i, '')
  const logoUrl = tenant?.theme.logoUrl
  const logoUrlsByDaypart = tenant?.theme.logoUrlsByDaypart
  const logosAttr =
    logoUrlsByDaypart && Object.keys(logoUrlsByDaypart).length > 0
      ? JSON.stringify(logoUrlsByDaypart)
      : undefined

  return (
    <html
      lang="en"
      data-tenant-theme={themeAttr}
      data-tenant-product={productName || undefined}
      data-tenant-logo={logoUrl || undefined}
      data-tenant-logos={logosAttr}
      data-tenant-plan={tenant?.plan ?? 'free'}
      data-feature-access={tenant?.featureAccess ?? 'stable'}
      data-theme={tenant?.theme.mode === 'light' ? 'day' : undefined}
      // Theme attrs + browser extensions (e.g. ColorZilla cz-shortcut-listen) may
      // differ between SSR HTML and the hydrated DOM — ignore those mismatches.
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content={tenant?.theme.accent ?? '#7c5cff'} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content={productName ?? 'BEVEL'} />
        {/* Chrome rejects SVG for apple-touch-icon / installed-app icons. */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
        {/* Magenta first-party suite injected via body component */}
      </head>
      <body style={themeStyle} suppressHydrationWarning>
        <MagentaAnalytics />
        <AuthProvider>
          <DaypartProvider>
            <CommandPaletteProvider>
              <PreferencesHost>
                <PwaRegister />
                {children}
              </PreferencesHost>
            </CommandPaletteProvider>
          </DaypartProvider>
        </AuthProvider>
      </body>
    </html>
  )
}