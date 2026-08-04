import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalNav } from '@/components/marketing/LegalNav'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { BEVEL_NAME } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `California Privacy (CCPA) · ${BEVEL_NAME}`,
  description:
    'California Consumer Privacy Act / CPRA notice for BEVEL — rights to know, delete, correct, and opt out.',
}

const UPDATED = 'August 4, 2026'

export default function CcpaPage() {
  return (
    <MarketingPage title="California Privacy Notice (CCPA / CPRA)" kicker="Legal">
      <p>
        <strong className="text-foreground">Last updated:</strong> {UPDATED}
      </p>
      <p>
        This notice supplements the{' '}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy Policy
        </Link>{' '}
        for California residents under the California Consumer Privacy Act as amended by
        the CPRA (“CCPA”). Capitalized terms have the meanings given in the CCPA unless
        otherwise defined.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">
        1. Categories of personal information
      </h2>
      <p>In the past 12 months we may have collected:</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-foreground">Identifiers</strong> — name, email, IP
          address, account IDs, handles
        </li>
        <li>
          <strong className="text-foreground">Customer records</strong> — profile and
          workspace account information
        </li>
        <li>
          <strong className="text-foreground">Commercial information</strong> — plan or
          subscription status (if any)
        </li>
        <li>
          <strong className="text-foreground">Internet / network activity</strong> — usage
          logs, device data, cookies
        </li>
        <li>
          <strong className="text-foreground">Geolocation</strong> — approximate location
          from IP (not precise GPS unless you enable a feature that requires it)
        </li>
        <li>
          <strong className="text-foreground">Professional information</strong> — job
          title, org, tags you provide
        </li>
        <li>
          <strong className="text-foreground">Inferences</strong> — limited product
          preferences derived from settings you choose
        </li>
      </ul>
      <p className="pt-2">
        We do not intentionally collect sensitive personal information beyond what is
        needed for authentication and security (for example login credentials handled by
        identity providers).
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">2. Sources and purposes</h2>
      <p>
        Sources include you, your organization, identity providers, devices, and
        integrations you enable. Purposes include providing the Services, security,
        support, and improvements, as described in the Privacy Policy.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">3. Sale and sharing</h2>
      <p>
        <strong className="text-foreground">
          We do not sell personal information.
        </strong>{' '}
        We do not share personal information for cross-context behavioral advertising. We
        do not have actual knowledge that we sell or share personal information of
        consumers under 16.
      </p>
      <p>
        Because we do not sell or share in these ways, we do not operate a “Do Not Sell or
        Share My Personal Information” opt-out link for that purpose. If our practices
        change, we will update this notice and provide required opt-out mechanisms.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">4. Your CCPA rights</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-foreground">Know / access</strong> — categories and
          specific pieces of personal information we collected
        </li>
        <li>
          <strong className="text-foreground">Delete</strong> — request deletion, subject
          to legal exceptions
        </li>
        <li>
          <strong className="text-foreground">Correct</strong> — request correction of
          inaccurate personal information
        </li>
        <li>
          <strong className="text-foreground">Opt out of sale/share</strong> — not
          applicable while we do not sell or share as defined
        </li>
        <li>
          <strong className="text-foreground">Limit use of sensitive PI</strong> — where
          applicable
        </li>
        <li>
          <strong className="text-foreground">Non-discrimination</strong> — we will not
          discriminate for exercising CCPA rights
        </li>
      </ul>

      <h2 className="pt-4 text-xl font-semibold text-foreground">5. How to exercise rights</h2>
      <p>
        Email{' '}
        <a className="text-accent hover:underline" href="mailto:privacy@bevel.com">
          privacy@bevel.com
        </a>{' '}
        with the subject line “CCPA Request” and describe the request. We will verify your
        identity (for example via the email on your account). You may use an authorized
        agent as permitted by law; we may require proof of authorization.
      </p>
      <p>
        If your personal information is controlled by a workplace customer (for example
        messages in their BEVEL workspace), we may refer you to that organization.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">6. Retention</h2>
      <p>
        We retain personal information for as long as needed for the purposes described in
        the Privacy Policy, including legal, security, and backup needs.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">7. Contact</h2>
      <p>
        <a className="text-accent hover:underline" href="mailto:privacy@bevel.com">
          privacy@bevel.com
        </a>
      </p>

      <LegalNav current="/ccpa" />
    </MarketingPage>
  )
}
