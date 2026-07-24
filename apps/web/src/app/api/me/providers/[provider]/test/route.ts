import { NextResponse } from 'next/server'
import { auth } from '@/auth'

type Ctx = { params: Promise<{ provider: string }> }

export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }
  const { provider } = await ctx.params
  return NextResponse.json({
    ok: true,
    provider,
    message: 'Provider test accepted (live validation ships with secrets vault).',
  })
}
