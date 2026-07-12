import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { BEVEL_NAME } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `Security · ${BEVEL_NAME}`,
  description: 'How BEVEL isolates tenants, auth, and realtime namespaces.',
}

export default function SecurityPage() {
  return (
    <MarketingPage title="Security" kicker="Trust">
      <p>
        {BEVEL_NAME} is built multi-tenant from the ground up: host-based resolution,
        declarative tenant config, and realtime namespaces that keep channel history with
        the organization.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">Authentication</h2>
      <p>
        Google Workspace (and optional GitHub) via industry-standard OAuth. Access is
        gated by allowed email domains and exact email allowlists per workspace. Platform
        entry routes users to the correct org host after sign-in.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">Isolation</h2>
      <p>
        Each workspace is a tenant folder with its own domain, brand, features, and
        realtime namespace. Sessions mint tokens for the active org — not a shared chat
        bag. Agents and channels bind to that namespace.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">Transport</h2>
      <p>
        Live chat over WebSocket, streams over SSE, media only when you enable it. TLS is
        required on public hosts. Local development uses trusted local certificates.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">Validation</h2>
      <p>
        Tenant configs are schema-validated. Doctor checks catch misconfiguration before
        release. Prefer declare → validate → ship over hand-edited production state.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">Report an issue</h2>
      <p>
        Security reports:{' '}
        <a className="text-accent hover:underline" href="mailto:security@bevel.com">
          security@bevel.com
        </a>
        . See also our{' '}
        <Link href="/privacy" className="text-accent hover:underline">
          privacy policy
        </Link>
        .
      </p>
    </MarketingPage>
  )
}
