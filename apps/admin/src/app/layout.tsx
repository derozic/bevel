import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AuthProvider } from '@bevel/auth/client'
import './globals.css'

export const metadata: Metadata = {
  title: 'BEVEL Admin',
  description: 'Operator console for BEVEL tenants and domains',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}