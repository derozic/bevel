export const NATIVE_COMPLETE_PATH = '/api/auth/native-complete'
export const NATIVE_LOGIN_COOKIE = 'bevel_native'
export const NATIVE_RETURNED_COOKIE = 'bevel_native_returned'

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

/** Only intercept post-OAuth landing pages — never the whole site. */
export function shouldInterceptNativeBrowserPath(pathname: string): boolean {
  const p = pathname.trim() || '/'
  if (p === '/' || p === '') return true
  if (p === '/welcome' || p.startsWith('/welcome/')) return true
  if (p === '/workspaces' || p.startsWith('/workspaces/')) return true
  if (p === '/onboarding' || p.startsWith('/onboarding/')) return true
  if (p === '/me' || p.startsWith('/me/')) return true
  if (p.startsWith('/~')) return true
  if (p.startsWith('/bevel')) return true
  return false
}
