import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { BEVEL_NAME } from '@/lib/bevel'
import {
  LEGAL_JURISDICTION,
  LEGAL_OPERATOR,
  LEGAL_PRODUCT,
  LEGAL_UPDATED,
} from '@/lib/legal'
import { BEVEL_LEGAL_EMAIL } from '@/lib/marketing'

export const metadata: Metadata = {
  title: `Data Processing Addendum · ${BEVEL_NAME}`,
  description: `Data Processing Addendum for ${LEGAL_PRODUCT} workspace customers, including subprocessors and security.`,
}

export default function DpaPage() {
  return (
    <MarketingPage title="Data Processing Addendum" kicker="Legal" article legal>
      <p>
        <strong className="text-foreground">Last updated:</strong> {LEGAL_UPDATED}
      </p>
      <p>
        This Data Processing Addendum (“DPA”) is between the organization that holds a{' '}
        {LEGAL_PRODUCT} workspace (“Customer”) and {LEGAL_OPERATOR} (“Processor”). It
        applies when Processor processes Customer Personal Data on Customer’s behalf to
        provide the Service, and forms part of the{' '}
        <Link href="/terms" className="text-accent hover:underline">
          Terms of Service
        </Link>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">1. Roles</h2>
      <p>
        Customer is the controller (or a processor acting for its own controller) of
        workspace content, membership, and messages. Processor processes that Customer
        Personal Data only on documented instructions: to host channels, deliver
        agents Customer enables, authenticate members, and secure the tenant.
        Processor is the independent controller of its own account, billing, and
        platform telemetry, as described in the{' '}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">2. Details of processing</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong className="text-foreground">Subject matter:</strong> hosting
          Customer’s {LEGAL_PRODUCT} workspace.
        </li>
        <li>
          <strong className="text-foreground">Duration:</strong> the term of the
          Agreement plus deletion or return as below.
        </li>
        <li>
          <strong className="text-foreground">Nature:</strong> storage, transmission,
          display, backup, and support.
        </li>
        <li>
          <strong className="text-foreground">Types of data:</strong> names, emails,
          messages, files, agent transcripts, and related metadata Customer or its
          users submit.
        </li>
        <li>
          <strong className="text-foreground">Data subjects:</strong> Customer’s
          employees, contractors, and other people Customer invites.
        </li>
      </ul>

      <h2 className="pt-4 text-xl font-semibold text-foreground">3. Processor obligations</h2>
      <p>
        Processor will: process only on Customer’s instructions; ensure people who
        handle Customer Personal Data are bound to confidentiality; implement the
        security measures on our{' '}
        <Link href="/security" className="text-accent hover:underline">
          Security
        </Link>{' '}
        page; assist with data-subject requests that Customer cannot fulfill alone;
        notify Customer without undue delay after becoming aware of a personal-data
        breach; and delete or return Customer Personal Data at the end of the Service,
        unless law requires storage.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">4. Subprocessors</h2>
      <p>
        Customer authorizes Processor to use the subprocessors listed in the Privacy
        Policy (currently Google, Apple, Microsoft, Twilio, SendGrid, and Amazon Web
        Services) for the purposes stated there. Processor remains responsible for
        their performance. Processor will post material subprocessor changes on this
        page and give Customer a reasonable opportunity to object before they process
        Customer Personal Data.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">5. International transfers</h2>
      <p>
        Where Customer Personal Data is transferred from the EEA or UK to a country
        without an adequacy decision, the parties incorporate the Standard Contractual
        Clauses (and UK Addendum as applicable), with Customer as data exporter and
        Processor as data importer, module two (controller to processor) unless
        Customer is itself a processor, in which case module three applies.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">6. Audits</h2>
      <p>
        Processor will make available information reasonably necessary to demonstrate
        compliance with this DPA. On 30 days’ written notice, not more than once per
        year (unless a confirmed breach), Customer may audit Processor’s relevant
        controls, or accept a current independent report in lieu of an on-site audit.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">7. Governing law</h2>
      <p>
        This DPA follows the governing law of the Agreement ({LEGAL_JURISDICTION}),
        except that the SCCs follow their own governing-law clauses. Questions:{' '}
        <a className="text-accent hover:underline" href={`mailto:${BEVEL_LEGAL_EMAIL}`}>
          {BEVEL_LEGAL_EMAIL}
        </a>
        .
      </p>
    </MarketingPage>
  )
}
