import { cookies } from 'next/headers'

export const NATIVE_COMPLETE_PATH = '/api/auth/native-complete'
const COOKIE = 'bevel_native'

export function isNativeLoginRequest(params: {
  native?: string
  callbackUrl?: string
  return?: string
}): boolean {
  if (params.native === '1' || params.native === 'true') return true
  const cb = params.callbackUrl ?? ''
  const ret = params.return ?? ''
  return (
    cb.includes('native-complete') ||
    ret.includes('native-complete') ||
    ret.startsWith('bevel://')
  )
}

export async function isNativeLoginPending(): Promise<boolean> {
  const jar = await cookies()
  return jar.get(COOKIE)?.value === '1'
}

export async function clearNativeLogin(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE)
}
