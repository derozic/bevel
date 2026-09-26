import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { BEVEL_NAME } from '@/lib/bevel'
import { LEGAL_PRODUCT, LEGAL_UPDATED } from '@/lib/legal'
import { BEVEL_PRIVACY_EMAIL } from '@/lib/marketing'

export const metadata: Metadata = {
  title: `Cookie Policy · ${BEVEL_NAME}`,
  description: `Cookies and similar technologies used by ${LEGAL_PRODUCT} for sessions, CSRF, and sign-in.`,
}

export default function CookiesPage() {
  return (
    <MarketingPage title="Cookie Policy" kicker="Legal" article legal>
      <p>
        <strong className="text-foreground">Last updated:</strong> {LEGAL_UPDATED}
      </p>
      <p>
        This policy describes cookies and similar storage {LEGAL_PRODUCT} uses. It
        supplements the{' '}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">What we set</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-foreground">Session.</strong> Auth.js session and
          callback cookies so we know you are signed in. Secure, HTTP-only, host-scoped
          on HTTPS hosts including <code>.lvh.me</code> and production.
        </li>
        <li>
          <strong className="text-foreground">CSRF.</strong> A token cookie paired with
          the sign-in form so a third-party site cannot POST a Google or Microsoft
          sign-in as you.
        </li>
        <li>
          <strong className="text-foreground">Last used method.</strong> A value in{' '}
          <code>localStorage</code> (<code>bevel.lastSignIn</code>) so the login card
          can badge the provider you used last. It never leaves your device.
        </li>
        <li>
          <strong className="text-foreground">Preferences.</strong> Device-local UI
          settings (day part, density) stored in the browser.
        </li>
        <li>
          <strong className="text-foreground">Native handoff.</strong> Short-lived
          cookies that finish sign-in from the desktop or mobile app back into the
          browser, then expire.
        </li>
      </ul>

      <h2 className="pt-4 text-xl font-semibold text-foreground">What we do not set</h2>
      <p>
        We do not set advertising cookies. We do not drop third-party marketing pixels
        on the signed-out login card. If we add non-essential analytics cookies later,
        this page will list them and we will ask before they run in regions that
        require consent.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Duration</h2>
      <p>
        Session cookies last up to 30 days or until you sign out. CSRF cookies are
        short-lived around a sign-in attempt. Last-used is stored until you clear site
        data.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Your controls</h2>
      <p>
        You can block or delete cookies in your browser. Blocking session or CSRF
        cookies will prevent sign-in. Clearing site data removes last-used and local
        preferences. Questions:{' '}
        <a className="text-accent hover:underline" href={`mailto:${BEVEL_PRIVACY_EMAIL}`}>
          {BEVEL_PRIVACY_EMAIL}
        </a>
        .
      </p>
    </MarketingPage>
  )
}
