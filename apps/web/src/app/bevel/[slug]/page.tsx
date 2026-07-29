import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireTenantFromRequest } from '@bevel/tenant-config'
import {
  BEVEL_ARCHIVE_PATH,
  BEVEL_TAGLINE,
  BEVEL_TALK_PATH,
  bevelChannelHref,
  bevelPageTitle,
  normalizeBevelChannelSlug,
} from '@/lib/bevel'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tenant = await requireTenantFromRequest().catch(() => null)
  const workspace = tenant?.theme.productName ?? tenant?.name
  return {
    title: bevelPageTitle(normalizeBevelChannelSlug(slug), workspace),
    description: BEVEL_TAGLINE,
  }
}

/**
 * Legacy path `/bevel/:slug` → canonical hash URL `/#slug`.
 * Middleware also 308s here; this covers direct server navigations.
 */
export default async function BevelChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ agents?: string; msg?: string; q?: string }>
}) {
  const { slug } = await params
  const { agents: agentsParam, msg, q } = await searchParams

  if (slug === 'talk') {
    redirect(BEVEL_TALK_PATH)
  }
  if (slug === 'session') {
    redirect(BEVEL_ARCHIVE_PATH)
  }

  const channelSlug = normalizeBevelChannelSlug(slug)
  const paramsQs = new URLSearchParams()
  if (agentsParam?.trim()) paramsQs.set('agents', agentsParam.trim())
  if (msg?.trim()) paramsQs.set('msg', msg.trim())
  if (q?.trim()) paramsQs.set('q', q.trim())
  const qs = paramsQs.toString()
  // Prefer bevelChannelHref when only agents; full query support here.
  if (qs && (msg || q)) {
    redirect(qs ? `/?${qs}#${channelSlug}` : `/#${channelSlug}`)
  }
  redirect(bevelChannelHref(channelSlug, agentsParam))
}
