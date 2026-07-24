import { NextResponse } from 'next/server'
import { auth } from '@/auth'

/**
 * Lightweight settings payload for the console.
 * Provider secrets stay client-local until a full vault lands in Postgres.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }

  return NextResponse.json({
    profile_name: session.user.name || session.user.email.split('@')[0] || '',
    profile_handle: session.user.email.split('@')[0] || '',
    active_provider: 'claude',
    debug_logs: false,
    natural_language: true,
    email: session.user.email,
    name: session.user.name,
    providers: {
      claude: { configured: false, key_preview: '' },
      openai: { configured: false, key_preview: '' },
      gemini: { configured: false, key_preview: '' },
      grok: { configured: false, key_preview: '' },
      kimi: { configured: false, key_preview: '' },
    },
  })
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  return NextResponse.json({ ok: true, saved: body })
}

export async function PATCH(request: Request) {
  return PUT(request)
}
