import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { BEVEL_NAME } from '@/lib/bevel'
import {
  LEGAL_OPERATOR,
  LEGAL_PRODUCT,
  LEGAL_UPDATED,
} from '@/lib/legal'
import { BEVEL_PRIVACY_EMAIL } from '@/lib/marketing'

export const metadata: Metadata = {
  title: `Privacy Policy · ${BEVEL_NAME}`,
  description: `How ${LEGAL_OPERATOR} handles personal information for ${LEGAL_PRODUCT}, including sign-in, workspaces, GDPR, and CCPA.`,
}

export default function PrivacyPage() {
  return (
    <MarketingPage title="Privacy Policy" kicker="Legal" article>
      <p>
        <strong className="text-foreground">Last updated:</strong> {LEGAL_UPDATED}
      </p>
      <p>
        {LEGAL_OPERATOR} (“Earthena,” “we,” “us”) operates {LEGAL_PRODUCT}. This policy
        describes how we handle personal information when you use our sites, apps, and
        APIs. For EEA/UK rights see our{' '}
        <Link href="/gdpr" className="text-accent hover:underline">
          GDPR notice
        </Link>
        . For California rights see our{' '}
        <Link href="/ccpa" className="text-accent hover:underline">
          CCPA notice
        </Link>
        . Cookies are described in our{' '}
        <Link href="/cookies" className="text-accent hover:underline">
          Cookie Policy
        </Link>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Who is responsible</h2>
      <p>
        Earthena is the controller of account, billing, and platform telemetry data.
        When you use a workspace, your organization is typically the controller of
        channel content and membership; Earthena processes that content as a processor
        under our{' '}
        <Link href="/dpa" className="text-accent hover:underline">
          DPA
        </Link>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Information we collect</h2>
      <p>
        <strong className="text-foreground">Account and identity.</strong> Name, email,
        avatar, and subject identifiers from Google, Apple, or Microsoft when you sign
        in. Phone number if you request an SMS code. Email address if you request a
        magic link. We do not collect a password.
      </p>
      <p>
        <strong className="text-foreground">Workspace.</strong> Organization name, slug,
        allowed domains, membership, channel messages, agent sessions, files you attach,
        and settings admins declare.
      </p>
      <p>
        <strong className="text-foreground">Technical.</strong> IP address, user agent,
        device type, timestamps, CSRF and session cookies, OTP rate-limit metadata, and
        error traces needed to run the Service.
      </p>
      <p>
        <strong className="text-foreground">Communications.</strong> Messages you send to
        support, and operational mail we send about the product.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">How we use it</h2>
      <p>
        To authenticate you, keep you signed in, route you to the correct workspace,
        deliver live chat and archives, send one-time codes, prevent abuse, improve
        reliability, communicate about the product, and meet legal obligations. We do
        not sell personal information and we do not share it for cross-context
        behavioral advertising.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Legal bases (EEA/UK)</h2>
      <p>
        Contract (to provide the Service you request), legitimate interests (security,
        product improvement, abuse prevention), consent where required (optional
        communications), and legal obligation. Details live on the{' '}
        <Link href="/gdpr" className="text-accent hover:underline">
          GDPR page
        </Link>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">How we share it</h2>
      <p>
        We share personal information with processors who help us run the Service, under
        contracts that limit their use:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Google — Sign in with Google / Workspace identity</li>
        <li>Apple — Sign in with Apple</li>
        <li>Microsoft — Microsoft Entra ID work-account sign-in</li>
        <li>Twilio — SMS one-time codes (Programmable Messaging only)</li>
        <li>SendGrid — email magic links and backup codes</li>
        <li>Amazon Web Services — hosting, storage, and secrets in production</li>
      </ul>
      <p>
        We may disclose information if required by law, to protect the Service or other
        users, or as part of a merger or sale, with notice where required.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">International transfers</h2>
      <p>
        We are based in the United States. If we transfer EEA/UK personal data to the
        U.S. or another third country, we use appropriate safeguards such as Standard
        Contractual Clauses. See the{' '}
        <Link href="/gdpr" className="text-accent hover:underline">
          GDPR notice
        </Link>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Retention</h2>
      <p>
        Sessions last until they expire or you sign out. OTP codes expire in ten minutes
        and are hashed at rest. Account records stay while the account is active.
        Workspace content stays until an admin deletes it or the workspace is closed,
        subject to backups and legal holds. Abuse and security logs are kept as long as
        needed to protect the Service.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Security</h2>
      <p>
        TLS on public hosts, tenant isolation by host and realtime namespace, hashed OTP
        codes, and access gated by identity providers plus workspace allowlists. See{' '}
        <Link href="/security" className="text-accent hover:underline">
          Security
        </Link>
        . No method is perfect; report issues to{' '}
        <a className="text-accent hover:underline" href={`mailto:${BEVEL_PRIVACY_EMAIL}`}>
          {BEVEL_PRIVACY_EMAIL}
        </a>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Children</h2>
      <p>
        The Service is not directed to children under 16. We do not knowingly collect
        personal information from children. If you believe we have, contact us and we
        will delete it.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Your choices</h2>
      <p>
        Sign out, close your account, or ask a workspace admin to remove you. Request
        access, correction, or deletion at{' '}
        <a className="text-accent hover:underline" href={`mailto:${BEVEL_PRIVACY_EMAIL}`}>
          {BEVEL_PRIVACY_EMAIL}
        </a>
        . Additional rights are described for the{' '}
        <Link href="/gdpr" className="text-accent hover:underline">
          EEA/UK
        </Link>{' '}
        and{' '}
        <Link href="/ccpa" className="text-accent hover:underline">
          California
        </Link>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Changes</h2>
      <p>
        We will update the date at the top of this page when the policy changes.
        Material changes will be posted here.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Contact</h2>
      <p>
        Privacy questions:{' '}
        <a className="text-accent hover:underline" href={`mailto:${BEVEL_PRIVACY_EMAIL}`}>
          {BEVEL_PRIVACY_EMAIL}
        </a>
        . {LEGAL_OPERATOR}.
      </p>
    </MarketingPage>
  )
}
