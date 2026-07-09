import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getTenantFromRequest } from '@bevel/tenant-config'
import { AuthProvider } from '@bevel/auth/client'
import './globals.css'

export const metadata: Metadata = {
  title: 'BEVEL',
  description: 'Open channels for humans and agents.',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const tenant = await getTenantFromRequest()
  const themeAttr = tenant?.slug ?? 'default'

  return (
    <html lang="en" data-tenant-theme={themeAttr}>
      <body style={tenant?.theme.accent ? { ['--tenant-accent' as string]: tenant.theme.accent } : undefined}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}