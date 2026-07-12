import { auth } from '@/auth'
import { DEFAULT_CHANNELS, type FleetChannelSummary } from '@/lib/fleet-channels'

/**
 * Channel list for the workspace rail.
 * Full multi-tenant channel CRUD can land later; for now return defaults so
 * the rail does not 404 while chat/realtime stay usable.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'Sign in required' }, { status: 401 })
  }

  const channels: FleetChannelSummary[] = DEFAULT_CHANNELS
  return Response.json({ channels })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'Sign in required' }, { status: 401 })
  }

  let payload: { slug?: string; name?: string; tags?: string[] } = {}
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const slug = (payload.slug ?? payload.name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
  if (!slug) {
    return Response.json({ error: 'Channel slug required' }, { status: 400 })
  }

  const channel: FleetChannelSummary = {
    slug,
    name: payload.name?.trim() || slug,
    tags: Array.isArray(payload.tags) ? payload.tags : ['bevel'],
  }

  // Declarative channel store not wired yet — echo created channel for UI.
  return Response.json({ channel }, { status: 201 })
}
