import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { BevelEntry } from '@/components/BevelEntry'
import { BEVEL_COPY, bevelChannelHref } from '@/lib/bevel'

export default async function BevelPage({
  searchParams,
}: {
  searchParams: Promise<{ agents?: string }>
}) {
  const session = await auth()
  const { agents } = await searchParams

  if (!session?.user) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(bevelChannelHref('general', agents))}`
    )
  }

  return (
    <Suspense fallback={<p className="px-6 text-sm text-ink-500">{BEVEL_COPY.openingChannel}</p>}>
      <BevelEntry />
    </Suspense>
  )
}