import { NextResponse } from 'next/server'
import { auth } from '@/auth'

type Ctx = { params: Promise<{ provider: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }
  const { provider } = await ctx.params
  return NextResponse.json({
    provider,
    configured: false,
    key_preview: '',
  })
}

export async function PUT(req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }
  const { provider } = await ctx.params
  const body = await req.json().catch(() => ({}))
  // Keys are acknowledged only — store vault is a follow-up (Postgres secrets table).
  return NextResponse.json({
    ok: true,
    provider,
    configured: Boolean((body as { api_key?: string }).api_key),
    key_preview: (body as { api_key?: string }).api_key
      ? `${String((body as { api_key: string }).api_key).slice(0, 4)}…`
      : '',
  })
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }
  const { provider } = await ctx.params
  return NextResponse.json({ ok: true, provider, configured: false })
}
