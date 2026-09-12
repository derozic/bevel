import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ConsoleShell } from '@/components/console/console-shell'

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=%2Fconsole')
  }
  return <ConsoleShell>{children}</ConsoleShell>
}
