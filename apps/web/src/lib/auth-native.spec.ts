import { describe, expect, it } from 'vitest'
import {
  isNativeLoginRequest,
  NATIVE_COMPLETE_PATH,
  shouldInterceptNativeBrowserPath,
} from './auth-native-shared'

describe('isNativeLoginRequest', () => {
  it('treats native=1 as a desktop/mobile return', () => {
    expect(isNativeLoginRequest({ native: '1' })).toBe(true)
    expect(isNativeLoginRequest({ native: 'true' })).toBe(true)
  })

  it('treats a native-complete callback as a return', () => {
    expect(
      isNativeLoginRequest({ callbackUrl: NATIVE_COMPLETE_PATH }),
    ).toBe(true)
  })

  it('treats a bevel:// return as a return', () => {
    expect(
      isNativeLoginRequest({ return: 'bevel://auth/complete' }),
    ).toBe(true)
  })

  it('only intercepts post-OAuth landing pages for the native bounce', () => {
    expect(shouldInterceptNativeBrowserPath('/welcome')).toBe(true)
    expect(shouldInterceptNativeBrowserPath('/~general')).toBe(true)
    expect(shouldInterceptNativeBrowserPath('/login')).toBe(false)
    expect(shouldInterceptNativeBrowserPath('/console/fleet')).toBe(false)
    expect(shouldInterceptNativeBrowserPath('/api/auth/callback/google')).toBe(
      false,
    )
  })

  it('leaves ordinary web login alone', () => {
    expect(isNativeLoginRequest({ callbackUrl: '/welcome' })).toBe(false)
    expect(isNativeLoginRequest({ callbackUrl: '/talk/hermes' })).toBe(false)
    expect(isNativeLoginRequest({})).toBe(false)
  })
})
