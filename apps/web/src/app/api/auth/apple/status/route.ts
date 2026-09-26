import { NextResponse } from 'next/server'
import { isAppleAuthConfigured } from '@bevel/auth'

/** Public: whether Sign in with Apple is wired. Never returns secrets. */
export async function GET() {
  return NextResponse.json(
    { configured: isAppleAuthConfigured() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
