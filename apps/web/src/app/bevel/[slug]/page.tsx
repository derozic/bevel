import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { BevelChatPane } from '@/components/BevelChatPane'
import {
  BEVEL_ARCHIVE_PATH,
  BEVEL_TAGLINE,
  BEVEL_TALK_PATH,
  bevelChannelPath,
  bevelPageTitle,
  normalizeBevelChannelSlug,
} from '@/lib/bevel'
import { resolveChatAgents } from '@/lib/chat-agents'


export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return {
    title: bevelPageTitle(normalizeBevelChannelSlug(slug)),
    description: BEVEL_TAGLINE,
  }
}

export default async function BevelChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ agents?: string }>
}) {
  const session = await auth()
  const { slug } = await params
  const { agents: agentsParam } = await searchParams

  if (slug === 'talk') {
    redirect(BEVEL_TALK_PATH)
  }
  if (slug === 'session') {
    redirect(BEVEL_ARCHIVE_PATH)
  }

  const initialAgents = resolveChatAgents(agentsParam)
  const channelSlug = normalizeBevelChannelSlug(slug)

  if (!session?.user) {
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(bevelChannelPath(channelSlug))}`
    )
  }

  return (
    <BevelChatPane channelSlug={channelSlug} initialAgents={initialAgents} />
  )
}