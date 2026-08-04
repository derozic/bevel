import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalNav } from '@/components/marketing/LegalNav'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { BEVEL_NAME } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `Terms · ${BEVEL_NAME}`,
  description: 'Terms of use for BEVEL workspaces, agents, and related services.',
}

const UPDATED = 'August 4, 2026'

export default function TermsPage() {
  return (
    <MarketingPage title="Terms of Use" kicker="Legal">
      <p>
        <strong className="text-foreground">Last updated:</strong> {UPDATED}
      </p>
      <p>
        These Terms of Use (“Terms”) govern access to {BEVEL_NAME} websites, APIs,
        workspaces, agents, and related software (the “Services”). By using the Services
        you agree to these Terms. If you use BEVEL on behalf of an organization, you
        represent that you have authority to bind that organization.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">1. The Services</h2>
      <p>
        {BEVEL_NAME} provides multi-tenant channels, agent dispatch, presence, integrations,
        and related workspace tools. Features may change as we improve the platform.
        Preview, beta, and local environments are provided as-is and may be unstable.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">2. Accounts and workspaces</h2>
      <p>
        You must provide accurate sign-in information and keep credentials secure. When
        you claim or administer a workspace, you are responsible for the namespace, allowed
        domains, memberships, integrations, and content posted under that tenant. Do not
        claim domains or brands you do not control. You must not share account credentials
        or circumvent access controls.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>Violate law or third-party rights</li>
        <li>Upload malware, spam, or abusive content</li>
        <li>Attempt to break isolation between tenants or access another workspace without authorization</li>
        <li>Scrape, overload, or reverse engineer the Services except as allowed by law</li>
        <li>Use agents or automation to harass, defraud, or cause harm</li>
        <li>Submit regulated or highly sensitive data unless your plan and configuration expressly support it</li>
      </ul>
      <p className="pt-2">
        We may suspend or terminate workspaces that violate these Terms or create risk for
        other customers.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">4. Customer content and agents</h2>
      <p>
        You retain rights to content you post (“Customer Content”). You grant BEVEL a
        worldwide, non-exclusive license to host, process, transmit, and display Customer
        Content solely to operate and improve the Services. Agent replies may be generated
        by third-party model providers using prompts and context you or your organization
        supply. Model output may be inaccurate; you are responsible for reviewing outputs
        before relying on them in production.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">5. Intellectual property</h2>
      <p>
        {BEVEL_NAME} software, branding, and documentation remain our property (or our
        licensors’). These Terms do not grant you rights to our marks except as needed to
        identify your use of the Services. Feedback you provide may be used without
        obligation to you.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">6. Third-party services</h2>
      <p>
        Integrations (identity providers, LLM APIs, Slack, GitHub, messaging bridges, and
        similar) are governed by their own terms. BEVEL is not responsible for third-party
        services you connect. See also our{' '}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link href="/subprocessors" className="text-accent hover:underline">
          Subprocessors
        </Link>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">7. Confidentiality</h2>
      <p>
        Each party may receive non-public information from the other. Recipients will use
        reasonable care to protect that information and use it only for purposes of the
        relationship, except where disclosure is required by law.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">8. Privacy and data processing</h2>
      <p>
        Our handling of personal data is described in the Privacy Policy. For organization
        workspaces where BEVEL processes personal data on your instructions, the{' '}
        <Link href="/dpa" className="text-accent hover:underline">
          Data Processing Addendum
        </Link>{' '}
        applies and is incorporated by reference when you accept these Terms or an order
        that references the DPA.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">9. Disclaimers</h2>
      <p>
        THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY
        KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS
        FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE FULLEST EXTENT PERMITTED BY
        LAW. We do not warrant that the Services will be uninterrupted, error-free, or
        free of harmful components.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">10. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY WILL BE LIABLE FOR INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOSS OF PROFITS, DATA,
        OR GOODWILL. OUR AGGREGATE LIABILITY ARISING OUT OF THE SERVICES WILL NOT EXCEED
        THE FEES PAID BY YOU TO BEVEL IN THE TWELVE (12) MONTHS BEFORE THE CLAIM (OR ONE
        HUNDRED U.S. DOLLARS IF YOU HAVE PAID NO FEES).
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">11. Indemnity</h2>
      <p>
        You will defend and indemnify BEVEL against claims arising from your Customer
        Content, your use of the Services in violation of these Terms, or your
        infringement of third-party rights, except to the extent caused by our willful
        misconduct.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">12. Termination</h2>
      <p>
        You may stop using the Services at any time. We may suspend or terminate access for
        breach, risk, or non-payment. Provisions that by nature should survive (including
        IP, disclaimers, liability limits, and indemnity) will survive termination.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">13. Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of Washington, USA, excluding
        conflict-of-law rules, unless mandatory consumer protection law in your country
        requires otherwise. Courts located in Spokane County, Washington, or the U.S.
        District Court for the Eastern District of Washington will have exclusive
        jurisdiction, subject to those mandatory protections.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">14. Changes</h2>
      <p>
        We may update these Terms by posting a new version with an updated date. Continued
        use after the effective date constitutes acceptance, except where local law
        requires additional consent.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">15. Contact</h2>
      <p>
        <a className="text-accent hover:underline" href="mailto:legal@bevel.com">
          legal@bevel.com
        </a>
      </p>

      <LegalNav current="/terms" />
    </MarketingPage>
  )
}
