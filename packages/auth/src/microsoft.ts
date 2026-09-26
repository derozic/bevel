/** Microsoft Entra ID (work account) sign-in — status only; Auth.js owns the flow. */

export const MICROSOFT_NOT_CONFIGURED =
  'Microsoft sign-in is not configured on this server yet. Use Google.'

export function microsoftClientId(): string {
  return (
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID ||
    process.env.MICROSOFT_CLIENT_ID ||
    ''
  ).trim()
}

export function microsoftClientSecret(): string {
  return (
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ||
    process.env.MICROSOFT_CLIENT_SECRET ||
    ''
  ).trim()
}

export function microsoftTenantId(): string {
  return (
    process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ||
    process.env.MICROSOFT_TENANT_ID ||
    'common'
  ).trim() || 'common'
}

export function microsoftIssuer(): string {
  const fromEnv = (process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || '').trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return `https://login.microsoftonline.com/${microsoftTenantId()}/v2.0`
}

export function isMicrosoftAuthConfigured(): boolean {
  return Boolean(microsoftClientId() && microsoftClientSecret())
}
