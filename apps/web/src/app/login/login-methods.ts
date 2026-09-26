/** Entity login method row — labels and data-cta values are the contract. */

export const LOGIN_METHOD_ORDER = [
  'google',
  'apple',
  'microsoft',
  'phone',
  'email-link',
] as const

export type LoginMethodCta = (typeof LOGIN_METHOD_ORDER)[number]

export const LOGIN_METHODS: ReadonlyArray<{
  cta: LoginMethodCta
  label: string
}> = [
  { cta: 'google', label: 'Sign in with Google' },
  { cta: 'apple', label: 'Sign in with Apple' },
  { cta: 'microsoft', label: 'Sign in with Microsoft' },
  { cta: 'phone', label: 'Continue with Phone Number' },
  { cta: 'email-link', label: 'Email me a one-time link' },
]

export const LOGIN_LEGAL =
  'By continuing, you agree to the Terms of Service and Privacy Policy.'

export const APPLE_NOT_CONFIGURED =
  'Apple sign-in is not configured on this server yet. Use Google.'

export const GOOGLE_NOT_CONFIGURED =
  'Google sign-in is not configured on this server yet.'

export const MICROSOFT_NOT_CONFIGURED =
  'Microsoft sign-in is not configured on this server yet. Use Google.'

const LAST_USED_KEY = 'bevel.lastSignIn'

export function readLastUsedMethod(): LoginMethodCta | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LAST_USED_KEY)
    if (LOGIN_METHOD_ORDER.includes(raw as LoginMethodCta)) {
      return raw as LoginMethodCta
    }
  } catch {
    /* private mode */
  }
  return null
}

export function writeLastUsedMethod(cta: LoginMethodCta) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_USED_KEY, cta)
  } catch {
    /* private mode */
  }
}

/** Email if `@` is present; SMS if it looks like a phone number. */
export function detectOtpChannel(raw: string): 'email' | 'sms' | null {
  const t = raw.trim()
  if (!t) return null
  if (t.includes('@')) {
    const [user, domain] = t.split('@')
    if (user && domain && domain.includes('.')) return 'email'
    return null
  }
  const digits = t.replace(/\D/g, '')
  if (digits.length >= 10) return 'sms'
  return null
}
