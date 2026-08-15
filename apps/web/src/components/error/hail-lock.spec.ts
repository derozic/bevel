import { describe, expect, it } from 'vitest'
import { hailProgress } from './hail-lock'

describe('hail lock', () => {
  it('needs three distinct agents', () => {
    expect(hailProgress(['hermes', 'hermes']).count).toBe(1)
    expect(hailProgress(['hermes', 'johnny', 'brain']).locked).toBe(true)
    expect(hailProgress(['hermes', 'johnny']).remaining).toBe(1)
  })
})
