import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'

export {
  isNativeLoginRequest,
  NATIVE_COMPLETE_PATH,
  NATIVE_LOGIN_COOKIE,
  NATIVE_RETURNED_COOKIE,
  shouldInterceptNativeBrowserPath,
} from './auth-native-shared'

import {
  NATIVE_LOGIN_COOKIE,
  NATIVE_RETURNED_COOKIE,
} from './auth-native-shared'

const COOKIE = NATIVE_LOGIN_COOKIE

export async function isNativeLoginPending(): Promise<boolean> {
  const jar = await cookies()
  return jar.get(COOKIE)?.value === '1'
}

export async function clearNativeLogin(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE)
}

/** After a successful native return, stop yanking every page back to the app. */
export function markNativeReturned(response: NextResponse): void {
  response.cookies.set(NATIVE_RETURNED_COOKIE, '1', {
    path: '/',
    maxAge: 2 * 60,
    sameSite: 'lax',
    httpOnly: true,
    secure: true,
  })
  response.cookies.set(NATIVE_LOGIN_COOKIE, '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
    httpOnly: true,
    secure: true,
  })
}


