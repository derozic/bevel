/**
 * Operator proxy for global agent settings.
 * Injects FLEET_INTERNAL_API_KEY server-side.
 */

const API =
  process.env.BEVEL_API_URL?.replace(/\/$/, '') ||
  process.env.NEXT_PUBLIC_BEVEL_API_URL?.replace(/\/$/, '') ||
  'https://api.bevel.lvh.me'

function internalHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = {}
  if (json) headers['Content-Type'] = 'application/json'
  const key = process.env.FLEET_INTERNAL_API_KEY
  if (key) headers['X-Fleet-Internal-Key'] = key
  return headers
}

export async function GET() {
  const res = await fetch(`${API}/api/v1/agent-settings/global`, {
    cache: 'no-store',
    headers: internalHeaders(),
  })
  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
    },
  })
}

export async function PUT(request: Request) {
  const body = await request.text()
  const res = await fetch(`${API}/api/v1/agent-settings/global`, {
    method: 'PUT',
    headers: internalHeaders(true),
    body,
  })
  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
    },
  })
}

export async function DELETE() {
  const res = await fetch(`${API}/api/v1/agent-settings/global`, {
    method: 'DELETE',
    headers: internalHeaders(),
  })
  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
    },
  })
}
