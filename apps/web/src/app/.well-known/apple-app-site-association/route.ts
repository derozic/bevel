import { appleAppSiteAssociationBody } from '@/lib/apple-app-site-association'

export const dynamic = 'force-static'

/** Apple fetches this without a file extension. No charset on Content-Type. */
export function GET() {
  return new Response(appleAppSiteAssociationBody(), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
  })
}
