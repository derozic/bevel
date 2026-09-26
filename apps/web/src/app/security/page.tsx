import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { BEVEL_NAME } from '@/lib/bevel'
import { LEGAL_PRODUCT, LEGAL_UPDATED } from '@/lib/legal'
import { BEVEL_SECURITY_EMAIL } from '@/lib/marketing'

export const metadata: Metadata = {
  title: `Security · ${BEVEL_NAME}`,
  description: `How ${LEGAL_PRODUCT} authenticates people, isolates tenants, and handles reports.`,
}

export default function SecurityPage() {
  return (
    <MarketingPage title="Security" kicker="Trust" article>
      <p>
        <strong className="text-foreground">Last updated:</strong> {LEGAL_UPDATED}
      </p>
      <p>
        {LEGAL_PRODUCT} is built multi-tenant from the ground up: host-based
        resolution, declarative tenant config, and realtime namespaces that keep
        channel history with the organization.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Authentication</h2>
      <p>
        People sign in with Google, Sign in with Apple, Microsoft Entra ID, an SMS
        one-time code, or an email magic link. There is no password database. OTP
        codes are hashed, expire in ten minutes, and are limited to five attempts with
        per-destination and per-IP rate limits. We talk to Apple over the raw Apple ID
        REST APIs (we mint the ES256 client secret). SMS uses Twilio Programmable
        Messaging. Email uses SendGrid. Access to a workspace is additionally gated by
        allowed email domains and exact email allowlists. Platform entry routes people
        to Private plus every membership after sign-in.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Isolation</h2>
      <p>
        Each workspace is a tenant with its own domain, brand, features, and realtime
        namespace. Sessions mint tokens for the active org — not a shared chat bag.
        Agents and channels bind to that namespace. We treat attempts to cross tenant
        isolation as a security incident.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Transport and secrets</h2>
      <p>
        Live chat over WebSocket, streams over SSE, media only when you enable it. TLS
        is required on public hosts. Local development uses trusted local certificates
        and HTTPS <code>.lvh.me</code> domains. Production secrets live in AWS Secrets
        Manager; development secrets live in 1Password. Credentials are never committed
        to the repository.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Validation</h2>
      <p>
        Tenant configs are schema-validated. Doctor checks catch misconfiguration
        before release. Prefer declare → validate → ship over hand-edited production
        state.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Data protection</h2>
      <p>
        See the{' '}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy Policy
        </Link>
        ,{' '}
        <Link href="/gdpr" className="text-accent hover:underline">
          GDPR
        </Link>
        ,{' '}
        <Link href="/ccpa" className="text-accent hover:underline">
          CCPA
        </Link>
        , and{' '}
        <Link href="/dpa" className="text-accent hover:underline">
          DPA
        </Link>{' '}
        for processing roles, subprocessors, and rights. Workspace customers remain
        controllers of channel content.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Report an issue</h2>
      <p>
        Security reports:{' '}
        <a className="text-accent hover:underline" href={`mailto:${BEVEL_SECURITY_EMAIL}`}>
          {BEVEL_SECURITY_EMAIL}
        </a>
        . Please include steps, impact, and whether tenant isolation is involved. We
        will acknowledge in a reasonable time and will not pursue good-faith research
        that stays within this policy.
      </p>
    </MarketingPage>
  )
}
