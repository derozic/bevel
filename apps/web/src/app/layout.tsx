import type { Metadata } from 'next'
import type { CSSProperties, ReactNode } from 'react'
import { getTenantFromRequest, tenantThemeCssVars } from '@bevel/tenant-config'
import { AuthProvider } from '@bevel/auth/client'
import './globals.css'

export const metadata: Metadata = {
  title: 'BEVEL',
  description: 'Open channels for humans and agents.',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const tenant = await getTenantFromRequest()
  const themeAttr = tenant?.slug ?? 'default'
  const themeStyle = tenantThemeCssVars(tenant) as CSSProperties

  return (
    <html
      lang="en"
      data-tenant-theme={themeAttr}
      data-theme={tenant?.theme.mode === 'light' ? 'day' : undefined}
    >
      <body style={themeStyle}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}