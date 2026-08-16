import { describe, expect, it } from 'vitest'
import { isNativeLoginRequest, NATIVE_COMPLETE_PATH } from './auth-native'

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

  it('leaves ordinary web login alone', () => {
    expect(isNativeLoginRequest({ callbackUrl: '/welcome' })).toBe(false)
    expect(isNativeLoginRequest({ callbackUrl: '/talk/hermes' })).toBe(false)
    expect(isNativeLoginRequest({})).toBe(false)
  })
})
