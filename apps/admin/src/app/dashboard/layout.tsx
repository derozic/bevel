'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Globe,
  LayoutDashboard,
  Megaphone,
  Radio,
  Settings,
  Users,
} from 'lucide-react'
import { cn } from '@bevel/ui'

const nav = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tenants', href: '/dashboard/tenants', icon: Users },
  { name: 'Domains', href: '/dashboard/domains', icon: Globe },
  { name: 'Announcements', href: '/dashboard/announcements', icon: Megaphone },
  { name: 'Realtime', href: '/dashboard/realtime', icon: Radio },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--bevel-border)] bg-[var(--bevel-surface)]">
        <div className="border-b border-[var(--bevel-border)] px-5 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--bevel-text-muted)]">
            BEVEL
          </p>
          <p className="text-lg font-semibold">Operator Console</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                  active
                    ? 'bg-white/10 text-[var(--bevel-text)]'
                    : 'text-[var(--bevel-text-muted)] hover:bg-white/5 hover:text-[var(--bevel-text)]',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}