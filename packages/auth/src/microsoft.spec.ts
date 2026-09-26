import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  MICROSOFT_NOT_CONFIGURED,
  isMicrosoftAuthConfigured,
  microsoftIssuer,
  microsoftTenantId,
} from './microsoft'

const saved = { ...process.env }

describe('microsoft entra auth', () => {
  beforeEach(() => {
    delete process.env.AUTH_MICROSOFT_ENTRA_ID_ID
    delete process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
    delete process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID
    delete process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
    delete process.env.MICROSOFT_CLIENT_ID
    delete process.env.MICROSOFT_CLIENT_SECRET
    delete process.env.MICROSOFT_TENANT_ID
  })

  afterEach(() => {
    process.env = { ...saved }
  })

  it('is unconfigured without client id and secret', () => {
    expect(isMicrosoftAuthConfigured()).toBe(false)
  })

  it('is configured when id and secret are set', () => {
    process.env.MICROSOFT_CLIENT_ID = 'app-id'
    process.env.MICROSOFT_CLIENT_SECRET = 'app-secret'
    expect(isMicrosoftAuthConfigured()).toBe(true)
  })

  it('defaults issuer to /common/v2.0', () => {
    expect(microsoftTenantId()).toBe('common')
    expect(microsoftIssuer()).toBe(
      'https://login.microsoftonline.com/common/v2.0',
    )
  })

  it('keeps the unconfigured sentence', () => {
    expect(MICROSOFT_NOT_CONFIGURED).toMatch(/not configured/i)
    expect(MICROSOFT_NOT_CONFIGURED).toMatch(/Use Google/)
  })
})
