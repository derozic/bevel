/**
 * Create BEVEL Google OAuth web client in GCP project (default: x4m-493516).
 *
 *   GCP_PROJECT_ID=x4m-493516 node scripts/setup-google-oauth.mjs
 *
 * Opens visible Chromium with a persistent profile. Sign in as scott@derozic.com
 * if prompted; the script waits and then creates the Web client.
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'x4m-493516'
const CLIENT_NAME = process.env.BEVEL_OAUTH_CLIENT_NAME || 'BEVEL Web'
const LOGIN_EMAIL = process.env.GCP_LOGIN_EMAIL || 'scott@derozic.com'

const ORIGINS = [
  'https://bevel.lvh.me',
  'https://demo.bevel.lvh.me',
]
const REDIRECTS = [
  'https://bevel.lvh.me/api/auth/callback/google',
  'https://demo.bevel.lvh.me/api/auth/callback/google',
]
const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, 'tmp', 'oauth-setup')
const PROFILE_DIR = join(ROOT, 'tmp', 'chrome-cloud-profile')
mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(PROFILE_DIR, { recursive: true })

const log = (...a) => console.log('[bevel-oauth]', ...a)

async function shot(page, name) {
  const path = join(OUT_DIR, `${name}.png`)
  try {
    await page.screenshot({ path, fullPage: true })
    log('screenshot', path)
  } catch (e) {
    log('screenshot failed', e.message)
  }
}

async function isConsole(page) {
  const url = page.url()
  return (
    url.includes('console.cloud.google.com') &&
    !url.includes('accounts.google.com') &&
    !url.includes('ServiceLogin') &&
    !url.includes('signin/oauth')
  )
}

async function ensureConsole(page, timeoutMs = 300_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (page.isClosed()) throw new Error('Browser page closed')
    // Prefill Google login email when present
    const email = page.locator('input[type="email"]').first()
    if (await email.isVisible({ timeout: 400 }).catch(() => false)) {
      const v = await email.inputValue().catch(() => '')
      if (!v) {
        await email.fill(LOGIN_EMAIL)
        log('prefilled login email', LOGIN_EMAIL)
      }
      const next = page.getByRole('button', { name: /Next/i }).first()
      if (await next.isVisible().catch(() => false)) {
        // Don't auto-submit password step — user may use passkey
      }
    }
    if (await isConsole(page)) {
      await page.waitForTimeout(1200)
      return true
    }
    await page.waitForTimeout(1500)
  }
  return false
}

async function clickText(page, patterns, timeout = 2500) {
  for (const p of patterns) {
    const loc = page.getByRole('button', { name: p }).first()
    if (await loc.isVisible({ timeout: 600 }).catch(() => false)) {
      await loc.click()
      return true
    }
    const t = page.getByText(p).first()
    if (await t.isVisible({ timeout: 600 }).catch(() => false)) {
      await t.click()
      return true
    }
  }
  // CSS fallbacks
  for (const p of patterns) {
    if (typeof p === 'string' && p.startsWith('css:')) {
      const el = page.locator(p.slice(4)).first()
      if (await el.isVisible({ timeout: 600 }).catch(() => false)) {
        await el.click()
        return true
      }
    }
  }
  return false
}

async function extractCreds(page) {
  const body = await page.locator('body').innerText().catch(() => '')
  const clientId = body.match(/[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com/i)?.[0]
  const clientSecret = body.match(/GOCSPX-[A-Za-z0-9_-]+/)?.[0]
  return { clientId, clientSecret, body }
}

function writeResult(result) {
  writeFileSync(join(OUT_DIR, 'bevel-oauth-client.json'), JSON.stringify(result, null, 2))
  writeFileSync(
    join(OUT_DIR, 'bevel-oauth.env'),
    [
      `AUTH_GOOGLE_ID=${result.clientId}`,
      `AUTH_GOOGLE_SECRET=${result.clientSecret || ''}`,
      `AUTH_GOOGLE_HD=derozic.com`,
      `AUTH_TRUST_HOST=true`,
      `AUTH_URL=https://bevel.lvh.me`,
      `NEXTAUTH_URL=https://bevel.lvh.me`,
    ].join('\n') + '\n',
  )
  log('wrote', join(OUT_DIR, 'bevel-oauth-client.json'))
}

async function configureConsent(page) {
  log('OAuth consent / branding')
  await page.goto(
    `https://console.cloud.google.com/auth/overview?project=${PROJECT_ID}`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.waitForTimeout(2000)
  if (!(await ensureConsole(page, 60_000))) return
  await shot(page, 'consent-overview')

  // Branding
  await page.goto(
    `https://console.cloud.google.com/auth/branding?project=${PROJECT_ID}`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.waitForTimeout(2000)
  await shot(page, 'consent-branding')

  const appName = page.getByLabel(/App name/i).first()
  if (await appName.isVisible({ timeout: 3000 }).catch(() => false)) {
    await appName.fill('BEVEL')
  }
  // Authorized domains — Google often rejects lvh.me (not a public domain).
  // Leave production domain empty for local-only Testing users.

  await clickText(page, [/Save/i, /SAVE/i])
  await page.waitForTimeout(1500)

  // Data Access / Scopes
  await page.goto(
    `https://console.cloud.google.com/auth/scopes?project=${PROJECT_ID}`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.waitForTimeout(2000)
  await shot(page, 'consent-scopes')

  await clickText(page, [/Add or remove scopes/i, /ADD OR REMOVE SCOPES/i, /Manage scopes/i])
  await page.waitForTimeout(1500)

  for (const scope of [
    'openid',
    'userinfo.email',
    '.../auth/userinfo.email',
    'userinfo.profile',
    '.../auth/userinfo.profile',
  ]) {
    const row = page.getByText(scope, { exact: false }).first()
    if (await row.isVisible({ timeout: 800 }).catch(() => false)) {
      // click checkbox in row if present
      const cb = row.locator('xpath=ancestor::tr[1]//input[@type="checkbox"]').first()
      if (await cb.isVisible().catch(() => false)) {
        if (!(await cb.isChecked().catch(() => false))) await cb.check().catch(() => {})
      } else {
        await row.click().catch(() => {})
      }
      log('selected scope row', scope)
    }
  }
  await clickText(page, [/Update/i, /Save/i, /Done/i])
  await page.waitForTimeout(1000)
  await clickText(page, [/Save/i, /SAVE/i])
  await shot(page, 'consent-scopes-saved')

  // Audience / test users (internal workspace preferred)
  await page.goto(
    `https://console.cloud.google.com/auth/audience?project=${PROJECT_ID}`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.waitForTimeout(1500)
  await shot(page, 'consent-audience')
}

async function createWebClient(page) {
  log('Create OAuth web client')

  // New Auth Platform clients UI
  const urls = [
    `https://console.cloud.google.com/auth/clients/create?project=${PROJECT_ID}`,
    `https://console.cloud.google.com/apis/credentials/oauthclient?project=${PROJECT_ID}`,
  ]

  for (const url of urls) {
    log('goto', url)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    if (!(await ensureConsole(page, 30_000))) continue
    await shot(page, 'create-start')

    // Classic credentials hub
    if (url.includes('/apis/credentials/oauthclient') || url.includes('/auth/clients/create')) {
      // Application type Web
      const web = page.getByText('Web application', { exact: true }).first()
      if (await web.isVisible({ timeout: 4000 }).catch(() => false)) {
        await web.click()
      } else {
        await clickText(page, [/Application type/i, /Select application type/i])
        await clickText(page, [/Web application/i, /^Web$/])
      }

      // Name
      const nameInput = page
        .getByLabel(/Name/i)
        .or(page.locator('input[aria-label*="Name" i]'))
        .first()
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill(CLIENT_NAME)
      }

      // Origins section
      for (const origin of ORIGINS) {
        const addOrigin = page.getByRole('button', { name: /Add URI/i }).first()
        // Prefer section-specific inputs
        const originBox = page
          .getByLabel(/Authorized JavaScript origin/i)
          .or(page.getByPlaceholder(/https:\/\/example.com/i))
          .first()
        if (await originBox.isVisible({ timeout: 1500 }).catch(() => false)) {
          await originBox.fill(origin)
          await originBox.press('Enter').catch(() => {})
        } else if (await addOrigin.isVisible().catch(() => false)) {
          // click add then fill last empty
          await addOrigin.click().catch(() => {})
          const inputs = page.locator('input[type="url"], input[type="text"]')
          const n = await inputs.count()
          if (n > 0) {
            await inputs.nth(n - 1).fill(origin)
            await inputs.nth(n - 1).press('Enter').catch(() => {})
          }
        }
        await page.waitForTimeout(300)
      }

      // Redirect URIs — often second "Add URI" group
      for (const redir of REDIRECTS) {
        // Find redirect-specific field
        const redirBox = page.getByLabel(/Authorized redirect URI/i).first()
        if (await redirBox.isVisible({ timeout: 1500 }).catch(() => false)) {
          await redirBox.fill(redir)
          await redirBox.press('Enter').catch(() => {})
        } else {
          // Click the last Add URI under redirects
          const adds = page.getByRole('button', { name: /Add URI/i })
          const c = await adds.count()
          if (c > 0) await adds.nth(c - 1).click().catch(() => {})
          const inputs = page.locator('input[type="url"], input[type="text"]')
          const n = await inputs.count()
          if (n > 0) {
            await inputs.nth(n - 1).fill(redir)
            await inputs.nth(n - 1).press('Enter').catch(() => {})
          }
        }
        await page.waitForTimeout(300)
      }

      await shot(page, 'create-filled')
      await clickText(page, [/^Create$/i, /^CREATE$/i, /^Save$/i])
      await page.waitForTimeout(3500)
      await shot(page, 'create-result')

      const creds = await extractCreds(page)
      if (creds.clientId) {
        writeResult({
          projectId: PROJECT_ID,
          clientName: CLIENT_NAME,
          clientId: creds.clientId,
          clientSecret: creds.clientSecret || '',
          origins: ORIGINS,
          redirects: REDIRECTS,
          scopes: SCOPES,
          createdAt: new Date().toISOString(),
        })
        return true
      }
    }
  }
  return false
}

async function main() {
  log('project', PROJECT_ID)
  log('client name', CLIENT_NAME)
  log('origins', ORIGINS)
  log('redirects', REDIRECTS)
  log('scopes', SCOPES)

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    devtools: true,
    slowMo: 50,
    viewport: { width: 1440, height: 1000 },
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const page = context.pages()[0] || (await context.newPage())
  page.setDefaultTimeout(45_000)

  const startUrl = `https://console.cloud.google.com/apis/credentials?project=${PROJECT_ID}`
  log('open', startUrl)
  await page.goto(startUrl, { waitUntil: 'domcontentloaded' })
  await shot(page, '01-start')

  log(`Sign in as ${LOGIN_EMAIL} if prompted — waiting for Cloud Console…`)
  const ok = await ensureConsole(page, 300_000)
  if (!ok) throw new Error('Timed out waiting for Cloud Console login')
  await shot(page, '02-console')

  await configureConsent(page)
  const created = await createWebClient(page)

  if (!created) {
    log('Automated create incomplete — waiting for manual completion (5 min)')
    log('Create Web application client with the origins/redirects above, then leave the success dialog open.')
    const start = Date.now()
    while (Date.now() - start < 300_000) {
      const creds = await extractCreds(page)
      if (creds.clientId && creds.clientSecret) {
        writeResult({
          projectId: PROJECT_ID,
          clientName: CLIENT_NAME,
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          origins: ORIGINS,
          redirects: REDIRECTS,
          scopes: SCOPES,
          createdAt: new Date().toISOString(),
          note: 'manual-assist',
        })
        log('SUCCESS (manual assist)')
        await context.close()
        return
      }
      await page.waitForTimeout(2000)
    }
    await shot(page, '99-timeout')
    await context.close()
    process.exit(2)
  }

  log('SUCCESS')
  await page.waitForTimeout(5000)
  await context.close()
}

main().catch(async (err) => {
  console.error(err)
  process.exit(1)
})
