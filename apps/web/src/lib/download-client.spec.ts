import { describe, expect, it } from 'vitest'
import {
  clientHeadline,
  featuredSurface,
  otaInstallLabel,
  parseDownloadClient,
  surfaceOrder,
} from './download-client'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const IPADOS_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

describe('parseDownloadClient', () => {
  it('recognizes iPhone, iPad, Android, Mac, and Windows', () => {
    expect(parseDownloadClient({ userAgent: IPHONE })).toBe('iphone')
    expect(parseDownloadClient({ userAgent: IPAD })).toBe('ipad')
    expect(parseDownloadClient({ userAgent: ANDROID })).toBe('android')
    expect(parseDownloadClient({ userAgent: MAC })).toBe('macos')
    expect(parseDownloadClient({ userAgent: WINDOWS })).toBe('windows')
  })

  it('treats iPadOS desktop UA + touch as iPad, not Mac', () => {
    expect(
      parseDownloadClient({ userAgent: IPADOS_DESKTOP, maxTouchPoints: 5 }),
    ).toBe('ipad')
    expect(parseDownloadClient({ userAgent: IPADOS_DESKTOP })).toBe('macos')
  })

  it('reads Client Hints when the UA is thin', () => {
    expect(
      parseDownloadClient({
        secChUaPlatform: '"iOS"',
        secChUaMobile: '?1',
      }),
    ).toBe('iphone')
    expect(
      parseDownloadClient({
        secChUaPlatform: '"Android"',
        secChUaMobile: '?1',
      }),
    ).toBe('android')
  })
})

describe('download page emphasis', () => {
  it('lights Install on this iPhone only on iPhone', () => {
    expect(otaInstallLabel('iphone')).toBe('Install on this iPhone')
    expect(otaInstallLabel('ipad')).toBe('Install on this iPad')
    expect(otaInstallLabel('macos')).toBeNull()
    expect(otaInstallLabel('android')).toBeNull()
    expect(otaInstallLabel('windows')).toBeNull()
  })

  it('sorts the matching surface first', () => {
    expect(surfaceOrder(featuredSurface('iphone'))[0]).toBe('ios')
    expect(surfaceOrder(featuredSurface('android'))[0]).toBe('android')
    expect(surfaceOrder(featuredSurface('macos'))[0]).toBe('macos')
    expect(surfaceOrder(featuredSurface('windows'))[0]).toBe('browser')
  })

  it('names the device in the headline', () => {
    expect(clientHeadline('iphone')).toMatch(/iPhone/)
    expect(clientHeadline('macos')).toMatch(/Mac/)
    expect(clientHeadline('android')).toMatch(/Android/)
  })
})
