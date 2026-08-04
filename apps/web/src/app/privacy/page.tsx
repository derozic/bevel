import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalNav } from '@/components/marketing/LegalNav'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { BEVEL_NAME } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `Privacy · ${BEVEL_NAME}`,
  description:
    'How BEVEL collects, uses, and protects personal data — including GDPR and CCPA rights.',
}

const UPDATED = 'August 4, 2026'

export default function PrivacyPage() {
  return (
    <MarketingPage title="Privacy Policy" kicker="Legal">
      <p>
        <strong className="text-foreground">Last updated:</strong> {UPDATED}
      </p>
      <p>
        {BEVEL_NAME} (“BEVEL,” “we,” “us”) provides multi-tenant workspace channels for
        humans and agents. This Privacy Policy explains how we collect, use, disclose, and
        protect personal information when you use bevel.is, related product hosts (for
        example workspace subdomains), APIs, desktop or mobile clients, and related
        services (collectively, the “Services”).
      </p>
      <p>
        If you use BEVEL under an organization workspace, your organization’s administrator
        may control membership, retention, and integrations. That organization may also be
        a “controller” of workspace content under applicable privacy law; we act as a
        processor for that content as described in our{' '}
        <Link href="/dpa" className="text-accent hover:underline">
          Data Processing Addendum
        </Link>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">1. Information we collect</h2>
      <h3 className="pt-2 text-base font-semibold text-foreground">Account and identity</h3>
      <p>
        Name, email address, profile photo, and authentication identifiers from sign-in
        providers (for example Google or GitHub), CLI handles, and optional profile fields
        you provide (bio, tags, location, job title, social links, personal agent
        preferences).
      </p>
      <h3 className="pt-2 text-base font-semibold text-foreground">Workspace and content</h3>
      <p>
        Organization name, slug, allowed domains, memberships, channel and session
        messages, agent transcripts, traces, tickets linked to work mode, files or
        attachments you upload, and integration configuration you connect (for example
        Slack, GitHub, SMS/iMessage bridges).
      </p>
      <h3 className="pt-2 text-base font-semibold text-foreground">Usage and device</h3>
      <p>
        IP address, browser and device type, approximate location derived from IP, pages
        and features used, diagnostic logs, crash and performance data, and cookies or
        similar technologies as described in our{' '}
        <Link href="/cookies" className="text-accent hover:underline">
          Cookie Policy
        </Link>
        .
      </p>
      <h3 className="pt-2 text-base font-semibold text-foreground">Billing (if applicable)</h3>
      <p>
        Plan tier, subscription status, and payment metadata processed by our payment
        provider. We do not store full card numbers on our servers when a third-party
        processor is used.
      </p>
      <h3 className="pt-2 text-base font-semibold text-foreground">Communications</h3>
      <p>
        Messages you send to support or legal contacts, survey responses, and product
        announcements you opt into.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">2. How we use information</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Authenticate users and route them to the correct workspace namespace</li>
        <li>Operate channels, presence, agent dispatch, search, and archives</li>
        <li>Provide, secure, and improve the Services (including debugging and abuse prevention)</li>
        <li>Personalize preferences you set (appearance, notifications, AI providers)</li>
        <li>Communicate about product, security, and account changes</li>
        <li>Comply with law and enforce our Terms</li>
      </ul>
      <p className="pt-2">
        <strong className="text-foreground">We do not sell personal information</strong> and
        we do not share personal information for cross-context behavioral advertising as
        those terms are defined under the CCPA/CPRA. See our{' '}
        <Link href="/ccpa" className="text-accent hover:underline">
          California Privacy Notice
        </Link>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">3. Legal bases (GDPR / UK GDPR)</h2>
      <p>Where the EU or UK GDPR applies, we process personal data on these bases:</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-foreground">Contract</strong> — to provide the Services you
          or your organization request
        </li>
        <li>
          <strong className="text-foreground">Legitimate interests</strong> — security,
          product improvement, and fraud prevention (balanced against your rights)
        </li>
        <li>
          <strong className="text-foreground">Consent</strong> — where required (for example
          certain cookies or optional marketing)
        </li>
        <li>
          <strong className="text-foreground">Legal obligation</strong> — tax, accounting, or
          lawful requests
        </li>
      </ul>

      <h2 className="pt-4 text-xl font-semibold text-foreground">4. How we share information</h2>
      <p>We share personal information only as needed to run BEVEL:</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-foreground">Service providers / subprocessors</strong> —
          hosting, auth, email, LLM routing, observability. See{' '}
          <Link href="/subprocessors" className="text-accent hover:underline">
            Subprocessors
          </Link>
          .
        </li>
        <li>
          <strong className="text-foreground">Workspace members and agents</strong> —
          content you post is visible to users and agents in that workspace according to
          permissions.
        </li>
        <li>
          <strong className="text-foreground">Integrations you enable</strong> — for example
          Slack, GitHub, or messaging bridges, subject to those products’ policies.
        </li>
        <li>
          <strong className="text-foreground">Legal and safety</strong> — when required by
          law, to protect rights and security, or in connection with a merger or
          acquisition (with notice where appropriate).
        </li>
      </ul>

      <h2 className="pt-4 text-xl font-semibold text-foreground">5. International transfers</h2>
      <p>
        We may process data in the United States and other countries where we or our
        subprocessors operate. Where GDPR requires safeguards for transfers from the EEA,
        UK, or Switzerland, we rely on appropriate mechanisms such as Standard Contractual
        Clauses and vendor assessments.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">6. Retention</h2>
      <p>
        We retain account and workspace data while your account or organization remains
        active and for a reasonable period afterward for backups, legal claims, and
        security. Workspace admins control membership and may request deletion of
        workspace content subject to technical and legal limits. Device-local preferences
        may remain in your browser until you clear them.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">7. Security</h2>
      <p>
        We use technical and organizational measures appropriate to the risk, including
        TLS in transit, tenant isolation, and access controls. No method of transmission
        or storage is perfectly secure. See our{' '}
        <Link href="/security" className="text-accent hover:underline">
          Security
        </Link>{' '}
        page. Report issues to{' '}
        <a className="text-accent hover:underline" href="mailto:security@bevel.com">
          security@bevel.com
        </a>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">8. Your rights (GDPR and similar)</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete,
        restrict, or port personal data; to object to certain processing; and to withdraw
        consent. You may also lodge a complaint with a supervisory authority. To exercise
        rights, email{' '}
        <a className="text-accent hover:underline" href="mailto:privacy@bevel.com">
          privacy@bevel.com
        </a>
        . We may need to verify your identity. If an organization workspace controls the
        data, we may direct you to that organization.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">9. California (CCPA/CPRA)</h2>
      <p>
        California residents have additional rights described in our{' '}
        <Link href="/ccpa" className="text-accent hover:underline">
          California Privacy Notice
        </Link>
        , including rights to know, delete, correct, and opt out of sale/share (we do not
        sell or share for cross-context behavioral advertising).
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">10. Children</h2>
      <p>
        The Services are not directed to children under 16 (or the age of digital consent
        in your jurisdiction). We do not knowingly collect personal information from
        children. Contact us if you believe we have done so.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">11. AI and agent processing</h2>
      <p>
        When you use agents or bring your own model keys, message content may be sent to
        model providers you or your organization configure (for example OpenRouter or
        direct provider APIs) to generate replies. Those providers process content under
        their terms. Do not submit secrets or regulated data unless your organization has
        approved that use.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">12. Changes</h2>
      <p>
        We may update this Policy from time to time. We will post the new version with an
        updated “Last updated” date and, for material changes, provide additional notice
        where required.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">13. Contact</h2>
      <p>
        Privacy:{' '}
        <a className="text-accent hover:underline" href="mailto:privacy@bevel.com">
          privacy@bevel.com
        </a>
        <br />
        Legal:{' '}
        <a className="text-accent hover:underline" href="mailto:legal@bevel.com">
          legal@bevel.com
        </a>
      </p>
      <p className="text-sm">
        Controller for platform account data is the BEVEL operator. For workspace content,
        the customer organization is typically the controller and BEVEL is the processor —
        see the{' '}
        <Link href="/dpa" className="text-accent hover:underline">
          DPA
        </Link>
        .
      </p>

      <LegalNav current="/privacy" />
    </MarketingPage>
  )
}
