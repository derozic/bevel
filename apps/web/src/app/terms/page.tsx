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
  title: `Terms of Service · ${BEVEL_NAME}`,
  description: `User Agreement for ${LEGAL_PRODUCT} workspaces, agents, and related services operated by ${LEGAL_OPERATOR}.`,
}

export default function TermsPage() {
  return (
    <MarketingPage title="Terms of Service" kicker="Legal" article>
      <p>
        <strong className="text-foreground">Last updated:</strong> {LEGAL_UPDATED}
      </p>
      <p>
        These Terms of Service (the “Agreement”) are a contract between you and{' '}
        {LEGAL_OPERATOR} (“Earthena,” “we,” “us”) governing access to {LEGAL_PRODUCT}{' '}
        websites, native applications, APIs, and related services (the “Service”). By
        creating an account, signing in, claiming a workspace, or using the Service, you
        agree to this Agreement. If you use the Service on behalf of an organization, you
        represent that you can bind that organization, and “you” includes that
        organization.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">1. The Service</h2>
      <p>
        {LEGAL_PRODUCT} provides multi-tenant channels for humans and agents: workspace
        namespaces, live chat, archives, agent dispatch, native desktop and mobile apps,
        and related tools. Features may change as we improve the platform. Preview, beta,
        and local environments are provided as-is and may be withdrawn at any time.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">2. Accounts and eligibility</h2>
      <p>
        You must be at least 16 years old (or the age of digital consent in your country,
        if higher). We do not offer password login. You sign in with Google, Apple,
        Microsoft Entra ID, a phone one-time code, or an email magic link. You are
        responsible for the devices and identity providers you use. Keep access to those
        accounts secure. Notify us at{' '}
        <a className="text-accent hover:underline" href={`mailto:${BEVEL_LEGAL_EMAIL}`}>
          {BEVEL_LEGAL_EMAIL}
        </a>{' '}
        if you believe your {LEGAL_PRODUCT} session was used without authorization.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">3. Workspaces</h2>
      <p>
        When you claim a workspace you control its namespace, allowed email domains,
        membership, and content. Do not claim domains, brands, or trademarks you do not
        control. Workspace admins are responsible for who they admit and for content
        posted under that tenant. We may reclaim unused or abusive namespaces.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">4. Acceptable use</h2>
      <p>
        You will not: (a) break the law; (b) attack, scrape, or degrade the Service;
        (c) attempt to cross tenant isolation or access another organization’s channels;
        (d) upload malware; (e) impersonate others; (f) use agents to harass, defraud, or
        generate unlawful content; or (g) resell the Service except under a written
        partner agreement. We may suspend or terminate workspaces that violate this
        section.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">5. Customer content</h2>
      <p>
        You retain rights to content you post (“Customer Content”). You grant Earthena a
        worldwide, non-exclusive license to host, process, transmit, and display Customer
        Content solely to operate and improve the Service. You represent that you have the
        rights needed to post it. {LEGAL_PRODUCT} software, marks, and documentation
        remain our property.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">6. Agents and model providers</h2>
      <p>
        Agents may call third-party model providers you enable. Outputs are probabilistic.
        You are responsible for prompts, tools, and anything an agent publishes in your
        workspace. Do not treat agent output as legal, medical, or financial advice.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">7. Fees</h2>
      <p>
        Some features require a paid plan. If you purchase a plan, you agree to the prices
        shown at checkout and any taxes. Unpaid invoices may result in suspension. Fees
        are non-refundable except where required by law or as we state in writing.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">8. Privacy</h2>
      <p>
        Our{' '}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy Policy
        </Link>
        ,{' '}
        <Link href="/gdpr" className="text-accent hover:underline">
          GDPR notice
        </Link>
        , and{' '}
        <Link href="/ccpa" className="text-accent hover:underline">
          CCPA notice
        </Link>{' '}
        describe how we handle personal information. Workspace customers that need a
        processor agreement should use our{' '}
        <Link href="/dpa" className="text-accent hover:underline">
          Data Processing Addendum
        </Link>
        .
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">9. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate access
        immediately for breach, risk to other tenants, or legal obligation. Upon
        termination we may delete Customer Content after a commercially reasonable
        retention window, subject to legal holds.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">10. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE FULLEST EXTENT
        PERMITTED BY LAW, EARTHENA DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not
        warrant uninterrupted or error-free operation.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">11. Limitation of liability</h2>
      <p>
        TO THE FULLEST EXTENT PERMITTED BY LAW, EARTHENA AND ITS AFFILIATES WILL NOT BE
        LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR
        FOR LOST PROFITS, REVENUE, OR DATA. OUR AGGREGATE LIABILITY FOR ALL CLAIMS ARISING
        OUT OF THE SERVICE IS LIMITED TO THE FEES YOU PAID US FOR THE SERVICE IN THE
        TWELVE MONTHS BEFORE THE CLAIM (OR ONE HUNDRED U.S. DOLLARS IF YOU PAID NOTHING).
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">12. Indemnity</h2>
      <p>
        You will defend and indemnify Earthena against claims arising from Customer
        Content, your use of agents, or your breach of this Agreement, including
        reasonable attorneys’ fees.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">13. Governing law</h2>
      <p>
        This Agreement is governed by the laws of {LEGAL_JURISDICTION}, excluding conflict
        of laws rules. Courts located in {LEGAL_JURISDICTION} have exclusive jurisdiction,
        except that we may seek injunctive relief in any forum to protect the Service or
        intellectual property. If you are a consumer in the EEA or UK, mandatory local
        consumer protections still apply.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">14. Changes</h2>
      <p>
        We may update this Agreement. The “Last updated” date will change. Material
        changes will be posted on this page. Continued use after the effective date is
        acceptance.
      </p>

      <h2 className="pt-4 text-xl font-semibold text-foreground">15. Contact</h2>
      <p>
        {LEGAL_OPERATOR}. Legal:{' '}
        <a className="text-accent hover:underline" href={`mailto:${BEVEL_LEGAL_EMAIL}`}>
          {BEVEL_LEGAL_EMAIL}
        </a>
        .
      </p>
    </MarketingPage>
  )
}
