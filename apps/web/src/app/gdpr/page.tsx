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
  title: `GDPR · ${BEVEL_NAME}`,
  description: `GDPR and UK GDPR rights for ${LEGAL_PRODUCT} users in the EEA and United Kingdom.`,
}

export default function GdprPage() {
  return (
    <MarketingPage title="GDPR" kicker="Legal" article>
      <p>
        <strong className="text-foreground">Last updated:</strong> {LEGAL_UPDATED}
      </p>
      <p>
        This notice supplements our{' '}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy Policy
        </Link>{' '}
        for people in the European Economic Area and the United Kingdom. It explains
        how {LEGAL_OPERATOR} complies with the EU General Data Protection Regulation
        and the UK GDPR when it processes personal data for {LEGAL_PRODUCT}.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Controller</h2>
      <p>
        {LEGAL_OPERATOR} is the controller of your account, authentication, and
        platform telemetry. Your organization is typically the controller of workspace
        content; we process that content under our{' '}
        <Link href="/dpa" className="text-accent hover:underline">
          Data Processing Addendum
        </Link>
        . Contact:{' '}
        <a className="text-accent hover:underline" href={`mailto:${BEVEL_PRIVACY_EMAIL}`}>
          {BEVEL_PRIVACY_EMAIL}
        </a>
        . Until a dedicated Data Protection Officer is appointed, that mailbox is the
        privacy contact.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Lawful bases</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-foreground">Contract (Art. 6(1)(b)).</strong> Creating
          an account, signing in with Google / Apple / Microsoft / OTP, delivering
          channels, and providing paid plans.
        </li>
        <li>
          <strong className="text-foreground">Legitimate interests (Art. 6(1)(f)).</strong>{' '}
          Securing the Service, rate-limiting OTP, debugging, preventing abuse, and
          understanding how the product is used. You may object; we will stop unless
          we have compelling grounds.
        </li>
        <li>
          <strong className="text-foreground">Consent (Art. 6(1)(a)).</strong> Optional
          product mail beyond what is needed to run your account. You can withdraw at
          any time.
        </li>
        <li>
          <strong className="text-foreground">Legal obligation (Art. 6(1)(c)).</strong>{' '}
          Tax, accounting, and lawful requests.
        </li>
      </ul>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Your rights</h2>
      <p>You may:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Access the personal data we hold about you</li>
        <li>Rectify inaccurate data</li>
        <li>Erase data (right to be forgotten), subject to legal holds</li>
        <li>Restrict or object to processing</li>
        <li>Receive a portable copy of data you provided</li>
        <li>Withdraw consent where processing is based on consent</li>
        <li>Lodge a complaint with a supervisory authority</li>
      </ul>
      <p>
        We respond within 30 days (extendable by 60 days for complex requests). We may
        need to verify your identity — usually by signing in to the same account.
        Email{' '}
        <a className="text-accent hover:underline" href={`mailto:${BEVEL_PRIVACY_EMAIL}`}>
          {BEVEL_PRIVACY_EMAIL}
        </a>{' '}
        with the subject “GDPR request.”
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Categories and sources</h2>
      <p>
        Identity data from Google, Apple, or Microsoft; phone numbers and emails you
        type on the sign-in screen; OTP metadata we generate; workspace content you or
        your teammates post; device and IP data from your browser or app. We do not
        buy personal data from brokers.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Transfers</h2>
      <p>
        {LEGAL_PRODUCT} is hosted in the United States. When we transfer personal data
        from the EEA or UK, we rely on the European Commission’s Standard Contractual
        Clauses (and the UK Addendum where required), plus supplementary measures such
        as TLS in transit and hashed OTP codes. Processors that receive data are listed
        in the Privacy Policy.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Automated decisions</h2>
      <p>
        We do not make solely automated decisions that produce legal or similarly
        significant effects about you. Agent outputs in a workspace are tools for that
        workspace, not decisions we take about a natural person as controller.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">Supervisory authority</h2>
      <p>
        You may complain to your local data protection authority. A list of EEA
        authorities is published by the European Data Protection Board. UK residents
        may contact the Information Commissioner’s Office.
      </p>
    </MarketingPage>
  )
}
