/**
 * Operator proxy for announcement update/delete.
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

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const body = await request.text()
  const res = await fetch(`${API}/api/v1/announcements/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: internalHeaders(true),
    body,
  })
  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
  })
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const res = await fetch(`${API}/api/v1/announcements/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: internalHeaders(),
  })
  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
  })
}
