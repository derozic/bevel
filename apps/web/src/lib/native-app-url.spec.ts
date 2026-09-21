import { describe, expect, it } from 'vitest'
import {
  isAppleMobileUserAgent,
  isBevelNativeUserAgent,
  nativeAppUrlFromLocation,
} from './native-app-url'

describe('nativeAppUrlFromLocation', () => {
  it('maps conversation URLs onto bevel:// routes the iPad app opens', () => {
    expect(nativeAppUrlFromLocation('https://bevel.is/talk/claude')).toBe(
      'bevel://talk/claude',
    )
    expect(nativeAppUrlFromLocation('https://bevel.is/talk/openai')).toBe(
      'bevel://talk/openai',
    )
    expect(nativeAppUrlFromLocation('https://bevel.is/talk/grok')).toBe(
      'bevel://talk/grok',
    )
    expect(
      nativeAppUrlFromLocation('https://bevel.2x4m.cc/~general?msg=abc'),
    ).toBe('bevel://channel/general?msg=abc')
    expect(nativeAppUrlFromLocation('https://bevel.is/me')).toBe('bevel://me')
  })

  it('does not offer Open in app inside the native WebView', () => {
    expect(isBevelNativeUserAgent('BevelNative/1.0.0')).toBe(true)
    expect(
      isAppleMobileUserAgent(
        'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) BevelNative/1.0.0',
      ),
    ).toBe(false)
    expect(
      isAppleMobileUserAgent(
        'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
      ),
    ).toBe(true)
    expect(
      isAppleMobileUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        5,
      ),
    ).toBe(true)
  })
})
