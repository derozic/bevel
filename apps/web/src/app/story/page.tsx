import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { BEVEL_NAME } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `Story · ${BEVEL_NAME}`,
  description: 'The story behind BEVEL — the edge where teams and agent fleets meet.',
}

export default function StoryPage() {
  return (
    <MarketingPage title="The edge where work meets the fleet" kicker="Story">
      <p>
        A bevel is a precise cut that lets two surfaces meet cleanly. Product teams and
        agent fleets have been living on opposite faces of the same problem: chat tools
        that ignore agents, and agent tools that ignore the room.
      </p>
      <p>
        {BEVEL_NAME} is that cut. One channel timeline. Humans and agents with presence.
        @mention to focus a specialist. Work mode that opens tickets and lands code in
        real repos — not advice that dies in a scrollback.
      </p>
      <p>
        Under the surface, every customer is a declared tenant: domain, brand, auth,
        features, and a realtime namespace. Validate with doctor. Release with confidence.
        History stays with the organization, not the entry host.
      </p>
      <p>
        We are building for teams who already run multi-product orgs and need agents that
        respect boundaries — and for new teams who want to claim a namespace before the
        fleet grows.
      </p>
      <p>
        <Link href="/claim" className="font-medium text-accent hover:underline">
          Claim your workspace
        </Link>
        {' · '}
        <Link href="/about" className="font-medium text-accent hover:underline">
          About us
        </Link>
      </p>
    </MarketingPage>
  )
}
