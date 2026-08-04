import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalNav } from '@/components/marketing/LegalNav'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { BEVEL_NAME } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `Cookies · ${BEVEL_NAME}`,
  description: 'How BEVEL uses cookies and similar technologies.',
}

const UPDATED = 'August 4, 2026'

export default function CookiesPage() {
  return (
    <MarketingPage title="Cookie Policy" kicker="Legal">
      <p>
        <strong className="text-foreground">Last updated:</strong> {UPDATED}
      </p>
      <p>
        This Cookie Policy explains how {BEVEL_NAME} uses cookies and similar technologies
        (local storage, session storage, pixels) on bevel.is and related product hosts.
        It should be read with our{' '}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">What are cookies?</h2>
      <p>
        Cookies are small text files stored on your device. Similar technologies store
        information in the browser for preferences, security, and performance.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">How we use them</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-foreground">
              <th className="py-2 pr-3 font-semibold">Category</th>
              <th className="py-2 pr-3 font-semibold">Purpose</th>
              <th className="py-2 font-semibold">Examples</th>
            </tr>
          </thead>
          <tbody className="text-muted">
            <tr className="border-b border-border/70">
              <td className="py-2 pr-3 align-top font-medium text-foreground">
                Strictly necessary
              </td>
              <td className="py-2 pr-3 align-top">
                Sign-in, session integrity, CSRF/OAuth state, load balancing, security
              </td>
              <td className="py-2 align-top">Auth session cookies, handoff codes</td>
            </tr>
            <tr className="border-b border-border/70">
              <td className="py-2 pr-3 align-top font-medium text-foreground">
                Functional
              </td>
              <td className="py-2 pr-3 align-top">
                Remember preferences (theme, day part, UI layout) on this device
              </td>
              <td className="py-2 align-top">Local preferences store</td>
            </tr>
            <tr className="border-b border-border/70">
              <td className="py-2 pr-3 align-top font-medium text-foreground">Analytics</td>
              <td className="py-2 pr-3 align-top">
                Understand product usage and reliability (when enabled)
              </td>
              <td className="py-2 align-top">First-party or privacy-preserving metrics</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="pt-3">
        We do not use third-party advertising cookies to sell personal information or for
        cross-context behavioral advertising.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Your choices</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Browser settings can block or delete cookies. Blocking strictly necessary cookies
          may prevent sign-in or core features.
        </li>
        <li>
          You can clear device-local preferences from your browser storage or reset
          preferences inside the product.
        </li>
        <li>
          Where consent is required for non-essential cookies, we will request it before
          setting them.
        </li>
      </ul>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Retention</h2>
      <p>
        Session cookies expire when you close the browser or after a short idle period.
        Persistent cookies and local storage last until they expire, you clear them, or we
        replace them.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Contact</h2>
      <p>
        <a className="text-accent hover:underline" href="mailto:privacy@bevel.com">
          privacy@bevel.com
        </a>
      </p>

      <LegalNav current="/cookies" />
    </MarketingPage>
  )
}
