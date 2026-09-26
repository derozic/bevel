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
  title: `CCPA / CPRA · ${BEVEL_NAME}`,
  description: `California privacy rights (CCPA and CPRA) for ${LEGAL_PRODUCT}, including Do Not Sell or Share.`,
}

export default function CcpaPage() {
  return (
    <MarketingPage title="CCPA / CPRA" kicker="Legal" article legal>
      <p>
        <strong className="text-foreground">Last updated:</strong> {LEGAL_UPDATED}
      </p>
      <p>
        This notice is for California residents and supplements our{' '}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy Policy
        </Link>
        . It describes rights under the California Consumer Privacy Act as amended by
        the California Privacy Rights Act (together, “CCPA”). {LEGAL_OPERATOR} is the
        business responsible for {LEGAL_PRODUCT} account data.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Notice at collection</h2>
      <p>In the last 12 months we have collected, and we collect, these categories:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Identifiers — name, email, phone, Apple / Google / Microsoft subject id, IP
          address
        </li>
        <li>Customer records — workspace membership, plan, support correspondence</li>
        <li>
          Commercial information — plan tier and invoices if you purchase a paid plan
        </li>
        <li>
          Internet activity — sign-in events, pages on our sites, device and log data
        </li>
        <li>
          Professional information — organization name and work email domain
        </li>
        <li>
          Inferences — none used for advertising; we may infer workspace role from
          membership
        </li>
        <li>
          Sensitive personal information — account credentials are held by identity
          providers; we store phone numbers used for OTP and messages you post in
          channels
        </li>
      </ul>
      <p>
        Sources: you, your identity provider, your workspace admin, and your devices.
        Purposes: provide the Service, security, support, and legal compliance. We do
        not collect these categories to advertise to you across other businesses.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">We do not sell or share</h2>
      <p>
        We do <strong className="text-foreground">not sell</strong> personal
        information. We do <strong className="text-foreground">not share</strong>{' '}
        personal information for cross-context behavioral advertising as those terms
        are defined by the CCPA. There is no need to opt out of a sale or share that
        does not occur. If that ever changes, we will provide a “Do Not Sell or Share
        My Personal Information” control on this page first.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Sensitive personal information</h2>
      <p>
        We use sensitive personal information only to provide the Service you request
        (sign-in, OTP, hosting your channels). We do not use or disclose it to infer
        characteristics about you. You may request that we limit use of sensitive
        personal information to those permitted purposes.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Your rights</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Know the categories and specific pieces of personal information we collected</li>
        <li>Delete personal information, subject to legal exceptions</li>
        <li>Correct inaccurate personal information</li>
        <li>Opt out of sale or sharing (we do not sell or share)</li>
        <li>Limit use of sensitive personal information</li>
        <li>Not be discriminated against for exercising CCPA rights</li>
      </ul>
      <p>
        Submit a request by emailing{' '}
        <a className="text-accent hover:underline" href={`mailto:${BEVEL_PRIVACY_EMAIL}`}>
          {BEVEL_PRIVACY_EMAIL}
        </a>{' '}
        with the subject “CCPA request” and whether you want to know, delete, correct,
        or limit. We will verify you by matching the email to a {LEGAL_PRODUCT} account
        and may ask you to sign in. We respond within 45 days (extendable by 45 days).
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Authorized agents</h2>
      <p>
        You may designate an authorized agent. We will need proof of authorization and
        may still verify your identity directly. We will not fulfill an agent request
        that we cannot reasonably verify.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Shine the Light</h2>
      <p>
        California Civil Code § 1798.83 (Shine the Light) lets residents ask about
        personal information disclosed to third parties for their direct marketing.
        We do not disclose personal information to third parties for their own direct
        marketing.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Retention</h2>
      <p>
        We keep each category only as long as needed for the purposes above, including
        security and legal holds, as described in the Privacy Policy.
      </p>
    </MarketingPage>
  )
}
