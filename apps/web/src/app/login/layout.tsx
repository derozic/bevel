import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'

/**
 * Login shell aligned with 2x4m.cc platform chrome:
 * light top bar, centered card content, no dark BEVEL-only frame.
 */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <header className="relative z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="https://2x4m.cc" className="flex items-center gap-3">
            <Image
              src="/brand/2x4m/logo.svg"
              alt="2x4m"
              width={36}
              height={36}
              className="h-8 w-auto"
              priority
            />
            <span className="font-display text-sm font-semibold tracking-tight text-gray-900">
              2x4m
            </span>
            <span className="hidden text-sm text-gray-500 sm:inline">Bevel</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-gray-600">
            <Link
              href="https://2x4m.cc"
              className="transition hover:text-gray-900"
            >
              Platform
            </Link>
            <Link
              href="https://agents.2x4m.cc"
              className="hidden transition hover:text-gray-900 sm:inline"
            >
              Agents
            </Link>
            <Link href="/" className="transition hover:text-gray-900">
              Workspace
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </div>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-500">
        <span>© 2026 2x4m Systems</span>
        <span className="mx-2">·</span>
        <Link href="https://2x4m.cc" className="font-medium hover:text-gray-800">
          Platform home
        </Link>
      </footer>
    </div>
  )
}
