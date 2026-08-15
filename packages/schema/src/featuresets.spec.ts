import { describe, expect, it } from 'vitest'
import {
  FEATURE_CATALOG,
  FEATURE_FLAG_IDS,
  defaultFeaturesForPlan,
  resolveFeatureSet,
} from './featuresets'

describe('feature catalog', () => {
  it('every flag id has a catalog entry (rail chips must not throw)', () => {
    for (const id of FEATURE_FLAG_IDS) {
      expect(FEATURE_CATALOG[id], id).toBeTruthy()
      expect(FEATURE_CATALOG[id]!.id).toBe(id)
    }
  })

  it('SMS is off on free and does not disable core chat flags', () => {
    const free = defaultFeaturesForPlan('free', 'stable')
    expect(free.sms).toBe(false)
    expect(free.otpSms).toBe(false)
    expect(free.channels).toBe(true)
    expect(free.directMessages).toBe(true)
    expect(free.liveSessions).toBe(true)
  })

  it('turning SMS off via override leaves conversations intact', () => {
    const set = resolveFeatureSet({
      plan: 'pro',
      featureAccess: 'beta',
      overrides: { sms: false },
    })
    expect(set.sms).toBe(false)
    expect(set.otpSms).toBe(false)
    expect(set.channels).toBe(true)
    expect(set.directMessages).toBe(true)
  })
})
