import { describe, expect, it } from 'vitest'
import { sanitizeAgentError } from './sanitize-agent-error'

describe('sanitizeAgentError', () => {
  it('does not leak Bearer tokens or runner stacks', () => {
    const err = new Error(
      "Cannot find module '/opt/bevel/dist/runner.js'\nRequire stack:\n- /opt/bevel/services/realtime/dist/agent-dispatch.js\nAuthorization: Bearer sk-or-v1-deadbeef",
    )
    const out = sanitizeAgentError('Loom', err)
    expect(out.code).toBe('module')
    expect(out.publicMessage).toMatch(/fleet runner/)
    expect(out.publicMessage).not.toMatch(/opt\/bevel/)
    expect(out.detail).not.toMatch(/sk-or-v1/)
    expect(out.detail).toMatch(/\[redacted/)
  })

  it('maps retired-model 404s to routing copy', () => {
    const out = sanitizeAgentError(
      'Loom',
      new Error('Request failed with status code 404'),
    )
    expect(out.code).toBe('model')
    expect(out.publicMessage).toMatch(/model routing/)
  })
})
