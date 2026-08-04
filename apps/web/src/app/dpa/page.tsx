import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalNav } from '@/components/marketing/LegalNav'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { BEVEL_NAME } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `Data Processing Addendum · ${BEVEL_NAME}`,
  description:
    'BEVEL Data Processing Addendum (DPA) for organization customers under GDPR and similar laws.',
}

const UPDATED = 'August 4, 2026'

export default function DpaPage() {
  return (
    <MarketingPage title="Data Processing Addendum (DPA)" kicker="Legal">
      <p>
        <strong className="text-foreground">Last updated:</strong> {UPDATED}
      </p>
      <p>
        This Data Processing Addendum (“DPA”) forms part of the agreement between the
        customer organization (“Customer”) and {BEVEL_NAME} (“Processor”) for use of the
        Services under the{' '}
        <Link href="/terms" className="text-accent hover:underline">
          Terms of Use
        </Link>{' '}
        or a separate order form. It applies when Processor processes Personal Data on
        behalf of Customer in connection with the Services.
      </p>
      <p className="text-sm">
        This public DPA is offered for transparency. Enterprise customers may execute a
        signed version via{' '}
        <a className="text-accent hover:underline" href="mailto:legal@bevel.com">
          legal@bevel.com
        </a>
        . Where a signed DPA conflicts with this page, the signed version controls.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">1. Definitions</h2>
      <p>
        “Personal Data,” “Processing,” “Controller,” “Processor,” “Data Subject,” and
        “Sub-processor” have the meanings in the EU GDPR / UK GDPR (as applicable).
        “Customer Data” means Personal Data contained in Customer Content processed by
        BEVEL on Customer’s instructions (for example channel messages and member
        profiles inside a Customer workspace).
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">2. Roles</h2>
      <p>
        For Customer Data, Customer is the Controller (or a Processor for its own
        end-customers) and BEVEL is the Processor. For platform account data of
        individual users interacting directly with BEVEL as a consumer of the platform,
        BEVEL may act as an independent controller as described in the{' '}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">3. Processing details</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-foreground">Subject matter:</strong> hosting and
          operating multi-tenant workspaces, channels, agents, and integrations
        </li>
        <li>
          <strong className="text-foreground">Duration:</strong> for the term of the
          Services and residual retention for backups and legal requirements
        </li>
        <li>
          <strong className="text-foreground">Nature:</strong> storage, transmission,
          display, search indexing, agent inference routing, logging
        </li>
        <li>
          <strong className="text-foreground">Purpose:</strong> providing the Services to
          Customer
        </li>
        <li>
          <strong className="text-foreground">Types of data:</strong> identifiers, contact
          data, message content, usage metadata, and other data Customer submits
        </li>
        <li>
          <strong className="text-foreground">Data subjects:</strong> Customer’s users,
          invitees, and individuals whose data is posted in the workspace
        </li>
      </ul>

      <h2 className="pt-4 text-xl font-semibold text-foreground">4. Customer instructions</h2>
      <p>
        Processor will process Customer Data only on documented instructions from
        Customer, including configuration of the Services, unless required by law (in
        which case Processor will notify Customer unless legally prohibited). The Terms,
        this DPA, and product configuration constitute documented instructions.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">5. Confidentiality</h2>
      <p>
        Processor ensures persons authorized to process Customer Data are bound by
        confidentiality obligations.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">6. Security</h2>
      <p>
        Processor implements appropriate technical and organizational measures as
        described in the{' '}
        <Link href="/security" className="text-accent hover:underline">
          Security
        </Link>{' '}
        page and Privacy Policy, including encryption in transit and tenant isolation.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">7. Sub-processors</h2>
      <p>
        Customer authorizes Processor to engage Sub-processors listed at{' '}
        <Link href="/subprocessors" className="text-accent hover:underline">
          /subprocessors
        </Link>
        . Processor will impose data protection terms no less protective than this DPA and
        remains responsible for Sub-processor performance. Processor will post updates to
        the subprocessor list; Customer may object on reasonable data-protection grounds
        within 15 days of a material addition by emailing{' '}
        <a className="text-accent hover:underline" href="mailto:privacy@bevel.com">
          privacy@bevel.com
        </a>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">8. International transfers</h2>
      <p>
        Where Customer Data is transferred from the EEA, UK, or Switzerland to a country
        not deemed adequate, Processor will ensure appropriate safeguards (including SCCs
        where required) with Sub-processors.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">9. Assistance</h2>
      <p>
        Taking into account the nature of processing, Processor will assist Customer with
        Data Subject requests, DPIAs, and breach notifications reasonably required under
        GDPR. Customer remains responsible for responding to Data Subjects regarding
        Customer Data.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">10. Breach notification</h2>
      <p>
        Processor will notify Customer without undue delay after becoming aware of a
        Personal Data breach affecting Customer Data, and will provide information
        reasonably available to help Customer meet its obligations.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">11. Return and deletion</h2>
      <p>
        Upon termination of the Services, Processor will delete or return Customer Data in
        accordance with product capabilities and Customer’s request, except where retention
        is required by law or for secure backups that expire on a fixed schedule.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">12. Audits</h2>
      <p>
        Upon reasonable written request, Processor will make available information
        necessary to demonstrate compliance with this DPA (for example security
        summaries). On-site audits require advance notice, reasonable scope, and may be
        limited to once per year unless a breach or regulatory requirement applies.
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

      <LegalNav current="/dpa" />
    </MarketingPage>
  )
}
