import { describe, expect, it } from 'vitest'
import {
  APPLE_NOT_CONFIGURED,
  MICROSOFT_NOT_CONFIGURED,
  LOGIN_METHOD_ORDER,
  LOGIN_METHODS,
  detectOtpChannel,
} from './login-methods'

describe('entity login methods', () => {
  it('is Google, Apple, Microsoft, then phone and email-link', () => {
    expect(LOGIN_METHOD_ORDER).toEqual([
      'google',
      'apple',
      'microsoft',
      'phone',
      'email-link',
    ])
    expect(LOGIN_METHODS.map((m) => m.cta)).toEqual([...LOGIN_METHOD_ORDER])
  })

  it('keeps Google first and Apple before Microsoft', () => {
    expect(LOGIN_METHODS[0]?.cta).toBe('google')
    expect(LOGIN_METHODS[1]?.cta).toBe('apple')
    expect(LOGIN_METHODS[2]?.cta).toBe('microsoft')
  })

  it('uses sign-in labels with no password method', () => {
    expect(LOGIN_METHODS.map((m) => m.label)).toEqual([
      'Sign in with Google',
      'Sign in with Apple',
      'Sign in with Microsoft',
      'Continue with Phone Number',
      'Email me a one-time link',
    ])
    expect(LOGIN_METHODS.some((m) => /password/i.test(m.label))).toBe(false)
  })

  it('keeps the Apple unconfigured sentence', () => {
    expect(APPLE_NOT_CONFIGURED).toMatch(/not configured/i)
    expect(APPLE_NOT_CONFIGURED).toMatch(/Use Google/)
  })

  it('keeps the Microsoft unconfigured sentence', () => {
    expect(MICROSOFT_NOT_CONFIGURED).toMatch(/not configured/i)
    expect(MICROSOFT_NOT_CONFIGURED).toMatch(/Use Google/)
  })
})

describe('detectOtpChannel', () => {
  it('routes email addresses to email', () => {
    expect(detectOtpChannel('you@company.com')).toBe('email')
    expect(detectOtpChannel('  scott@derozic.com  ')).toBe('email')
  })

  it('routes phone numbers to sms', () => {
    expect(detectOtpChannel('+15551234567')).toBe('sms')
    expect(detectOtpChannel('(555) 123-4567')).toBe('sms')
    expect(detectOtpChannel('5551234567')).toBe('sms')
  })

  it('rejects incomplete values', () => {
    expect(detectOtpChannel('')).toBeNull()
    expect(detectOtpChannel('not-an-email')).toBeNull()
    expect(detectOtpChannel('you@')).toBeNull()
    expect(detectOtpChannel('12345')).toBeNull()
  })
})
