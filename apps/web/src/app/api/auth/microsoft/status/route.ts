import { NextResponse } from 'next/server'
import { isMicrosoftAuthConfigured } from '@bevel/auth'

/** Public: whether Microsoft Entra sign-in is wired. Never returns secrets. */
export async function GET() {
  return NextResponse.json(
    { configured: isMicrosoftAuthConfigured() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
