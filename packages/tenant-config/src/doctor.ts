import { promises as dns } from 'node:dns'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  BEVEL_CNAME_TARGET,
  type DoctorCheck,
  type DoctorReport,
} from '@bevel/schema'
import {
  loadDeclarativeTenant,
  loadThemeTokens,
  tenantDir,
  resolveTenantsRoot,
} from './loader'

export type DoctorOptions = {
  tenantsRoot?: string
  cnameTarget?: string
  domainsServiceUrl?: string
  realtimeUrl?: string
  skipNetwork?: boolean
}

function check(
  id: string,
  label: string,
  status: DoctorCheck['status'],
  detail?: string,
): DoctorCheck {
  return { id, label, status, detail }
}

async function fetchOk(url: string, timeoutMs = 8000): Promise<{ ok: boolean; detail?: string }> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    return { ok: res.ok, detail: `${res.status} ${res.statusText}` }
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : 'request failed',
    }
  }
}

export async function runDoctor(
  slug: string,
  options: DoctorOptions = {},
): Promise<DoctorReport> {
  const root = options.tenantsRoot ?? resolveTenantsRoot()
  const cnameTarget = options.cnameTarget ?? process.env.BEVEL_CNAME_TARGET ?? BEVEL_CNAME_TARGET
  const domainsUrl =
    options.domainsServiceUrl ??
    process.env.DOMAINS_SERVICE_URL ??
    'http://127.0.0.1:43209'
  const realtimeUrl =
    options.realtimeUrl ?? process.env.REALTIME_URL ?? 'https://realtime.bevel.lvh.me'
  const skipNetwork = options.skipNetwork ?? process.env.BEVEL_DOCTOR_OFFLINE === '1'

  const checks: DoctorCheck[] = []

  // 1. Tenant config valid
  let declarative
  try {
    declarative = loadDeclarativeTenant(slug, root)
    if (declarative.tenant !== slug) {
      checks.push(
        check(
          'tenant-config',
          'Tenant config valid',
          'fail',
          `slug mismatch: file says "${declarative.tenant}", expected "${slug}"`,
        ),
      )
    } else {
      checks.push(check('tenant-config', 'Tenant config valid', 'pass', declarative.domain))
    }
  } catch (err) {
    checks.push(
      check(
        'tenant-config',
        'Tenant config valid',
        'fail',
        err instanceof Error ? err.message : 'invalid config',
      ),
    )
    return finalize(slug, checks)
  }

  const host = declarative.domain.toLowerCase().split(':')[0]
  const dir = tenantDir(slug, root)

  // 2. Domain CNAME
  if (skipNetwork) {
    checks.push(check('domain-cname', 'Domain CNAME configured', 'skip', 'offline mode'))
  } else {
    try {
      const res = await fetch(`${domainsUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, tenantId: `tenant_${slug}` }),
      })
      const data = (await res.json()) as { status?: string; failureReason?: string }
      if (data.status === 'verified') {
        checks.push(check('domain-cname', 'Domain CNAME configured', 'pass', `${host} → ${cnameTarget}`))
      } else {
        try {
          const records = await dns.resolveCname(host)
          const match = records.some(
            (r) => r.toLowerCase().replace(/\.$/, '') === cnameTarget.toLowerCase(),
          )
          checks.push(
            check(
              'domain-cname',
              'Domain CNAME configured',
              match ? 'pass' : 'warn',
              match
                ? `${host} → ${cnameTarget}`
                : data.failureReason ?? `CNAME not pointing at ${cnameTarget}`,
            ),
          )
        } catch {
          checks.push(
            check(
              'domain-cname',
              'Domain CNAME configured',
              'warn',
              data.failureReason ?? `No CNAME for ${host} (dev hostnames may skip DNS)`,
            ),
          )
        }
      }
    } catch (err) {
      checks.push(
        check(
          'domain-cname',
          'Domain CNAME configured',
          'warn',
          err instanceof Error ? err.message : 'domains service unreachable',
        ),
      )
    }
  }

  // 3. SSL active
  if (skipNetwork) {
    checks.push(check('ssl-active', 'SSL active', 'skip', 'offline mode'))
  } else {
    const preview = declarative.deployment?.preview_url ?? `https://${host}`
    const { ok, detail } = await fetchOk(`${preview}/api/health`)
    checks.push(
      check(
        'ssl-active',
        'SSL active',
        ok ? 'pass' : 'warn',
        ok ? preview : `HTTPS probe failed: ${detail}`,
      ),
    )
  }

  // 4. Theme tokens valid
  try {
    const tokens = loadThemeTokens(declarative, root)
    if (declarative.brand.logo) {
      const logoPath = resolve(dir, declarative.brand.logo)
      if (!existsSync(logoPath)) {
        checks.push(
          check('theme-tokens', 'Theme tokens valid', 'warn', `logo missing: ${declarative.brand.logo}`),
        )
      } else {
        checks.push(
          check('theme-tokens', 'Theme tokens valid', 'pass', `accent ${tokens.accent}`),
        )
      }
    } else {
      checks.push(
        check('theme-tokens', 'Theme tokens valid', 'pass', `accent ${tokens.accent}`),
      )
    }
  } catch (err) {
    checks.push(
      check(
        'theme-tokens',
        'Theme tokens valid',
        'fail',
        err instanceof Error ? err.message : 'invalid theme',
      ),
    )
  }

  // 5. Realtime namespace provisioned
  if (skipNetwork) {
    checks.push(check('realtime-namespace', 'Realtime namespace provisioned', 'skip', 'offline mode'))
  } else {
    const ns = declarative.realtime.namespace
    const healthUrl = declarative.realtime.url ?? realtimeUrl
    const base = healthUrl.replace(/\/$/, '')
    let probe = await fetchOk(`${base}/health`)
    if (!probe.ok) {
      probe = await fetchOk(
        `http://127.0.0.1:${process.env.REALTIME_PORT ?? 43208}/health`,
      )
    }
    const { ok, detail } = probe
    checks.push(
      check(
        'realtime-namespace',
        'Realtime namespace provisioned',
        ok ? 'pass' : 'warn',
        ok ? `namespace "${ns}" · transport websocket` : detail ?? 'realtime unreachable',
      ),
    )
  }

  // 6. Auth policy valid
  const authIssues: string[] = []
  if (
    declarative.auth.mode === 'magic-link' &&
    !declarative.auth.allowed_domains?.length &&
    !declarative.auth.allowed_emails?.length
  ) {
    authIssues.push('magic-link requires allowed_domains or allowed_emails')
  }
  if (declarative.features.work_mode && declarative.auth.mode !== 'github') {
    authIssues.push('work_mode enabled — recommend github auth')
  }
  checks.push(
    check(
      'auth-policy',
      'Auth policy valid',
      authIssues.length ? 'warn' : 'pass',
      authIssues.length ? authIssues.join('; ') : `mode: ${declarative.auth.mode}`,
    ),
  )

  // 7. Preview deployment healthy
  if (skipNetwork) {
    checks.push(check('preview-deployment', 'Preview deployment healthy', 'skip', 'offline mode'))
  } else {
    const preview = declarative.deployment?.preview_url ?? `https://${host}`
    const { ok, detail } = await fetchOk(`${preview}/api/health`)
    checks.push(
      check(
        'preview-deployment',
        'Preview deployment healthy',
        ok ? 'pass' : 'fail',
        ok ? preview : detail,
      ),
    )
  }

  return finalize(slug, checks)
}

function finalize(slug: string, checks: DoctorCheck[]): DoctorReport {
  const blocking = checks.some((c) => c.status === 'fail')
  return {
    tenant: slug,
    checkedAt: new Date().toISOString(),
    passed: !blocking,
    checks,
  }
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [
    `BEVEL doctor — ${report.tenant}`,
    '',
  ]
  for (const c of report.checks) {
    const icon =
      c.status === 'pass'
        ? '✓'
        : c.status === 'fail'
          ? '✗'
          : c.status === 'warn'
            ? '!'
            : '–'
    const suffix = c.detail ? ` — ${c.detail}` : ''
    lines.push(`${icon} ${c.label}${suffix}`)
  }
  lines.push('')
  lines.push(report.passed ? 'All required checks passed.' : 'Some checks failed.')
  return lines.join('\n')
}