import { redirect } from 'next/navigation'
import { bevelChannelHref } from '@/lib/bevel'

/** Legacy /bevel/c/:slug → canonical /bevel/:slug */
export default async function BevelLegacyChannelRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ agents?: string }>
}) {
  const { slug } = await params
  const { agents } = await searchParams
  redirect(bevelChannelHref(slug, agents))
}