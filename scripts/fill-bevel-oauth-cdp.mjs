/**
 * Attach to Chrome on :9222 and create BEVEL OAuth web client.
 * Sign in in that Chrome window if needed; script waits then fills the form.
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'x4m-493516'
const CLIENT_NAME = 'BEVEL Web'
const EMAIL = process.env.GCP_LOGIN_EMAIL || 'scott@derozic.com'
const ORIGINS = ['https://bevel.lvh.me', 'https://demo.bevel.lvh.me']
const REDIRECTS = [
  'https://bevel.lvh.me/api/auth/callback/google',
  'https://demo.bevel.lvh.me/api/auth/callback/google',
]
const OUT = join(process.cwd(), 'tmp', 'oauth-setup')
mkdirSync(OUT, { recursive: true })
const log = (...a) => console.log('[cdp-oauth]', ...a)

async function shot(page, n) {
  try {
    await page.screenshot({ path: join(OUT, `${n}.png`), fullPage: true })
    log('shot', n)
  } catch {}
}

async function waitConsole(page, ms = 300000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const url = page.url()
    // help login
    const email = page.locator('input[type="email"]').first()
    if (await email.isVisible({ timeout: 500 }).catch(() => false)) {
      const v = await email.inputValue().catch(() => '')
      if (!v) {
        await email.fill(EMAIL)
        log('filled email', EMAIL)
        const next = page.getByRole('button', { name: /^Next$/i }).first()
        if (await next.isVisible().catch(() => false)) {
          await next.click().catch(() => {})
          log('clicked Next on email step — complete password/passkey in the window')
        }
      }
    }
    if (
      url.includes('console.cloud.google.com') &&
      !url.includes('accounts.google.com')
    ) {
      return true
    }
    await page.waitForTimeout(1500)
  }
  return false
}

async function main() {
  log('connecting to Chrome :9222 …')
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
  const context = browser.contexts()[0]
  let page =
    context.pages().find((p) => p.url().includes('cloud.google') || p.url().includes('accounts.google')) ||
    context.pages()[0] ||
    (await context.newPage())

  // Prefer create client URL
  const createUrl = `https://console.cloud.google.com/auth/clients/create?project=${PROJECT_ID}`
  log('goto', createUrl)
  await page.goto(createUrl, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await shot(page, 'cdp-01')

  log('Waiting for Cloud Console (sign in in the debug Chrome window if needed)…')
  if (!(await waitConsole(page))) throw new Error('timeout waiting for console')
  await shot(page, 'cdp-02-console')

  // Branding / scopes first
  for (const [path, name] of [
    [`https://console.cloud.google.com/auth/branding?project=${PROJECT_ID}`, 'branding'],
    [`https://console.cloud.google.com/auth/scopes?project=${PROJECT_ID}`, 'scopes'],
    [`https://console.cloud.google.com/auth/audience?project=${PROJECT_ID}`, 'audience'],
  ]) {
    await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(2000)
    await shot(page, `cdp-${name}`)
    if (name === 'branding') {
      const app = page.getByLabel(/App name/i).first()
      if (await app.isVisible({ timeout: 2000 }).catch(() => false)) {
        await app.fill('BEVEL')
        log('set app name BEVEL')
      }
      const save = page.getByRole('button', { name: /^Save$/i }).first()
      if (await save.isVisible().catch(() => false)) await save.click().catch(() => {})
    }
    if (name === 'scopes') {
      const manage = page.getByRole('button', { name: /scope/i }).first()
      if (await manage.isVisible({ timeout: 2000 }).catch(() => false)) {
        await manage.click().catch(() => {})
        await page.waitForTimeout(1000)
      }
      for (const s of ['openid', 'userinfo.email', 'userinfo.profile', '.../auth/userinfo.email', '.../auth/userinfo.profile']) {
        const row = page.getByText(s, { exact: false }).first()
        if (await row.isVisible({ timeout: 600 }).catch(() => false)) {
          const cb = row.locator('xpath=ancestor::tr[1]//input[@type="checkbox"]').first()
          if (await cb.isVisible().catch(() => false)) {
            if (!(await cb.isChecked().catch(() => true))) await cb.check().catch(() => {})
          }
        }
      }
      await page.getByRole('button', { name: /Update|Save|Done/i }).first().click().catch(() => {})
    }
  }

  // Create client
  await page.goto(createUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await shot(page, 'cdp-create')

  // Application type
  const web = page.getByText('Web application', { exact: false }).first()
  if (await web.isVisible({ timeout: 5000 }).catch(() => false)) {
    await web.click()
    log('selected Web application')
  }

  // Name
  for (const sel of [
    page.getByLabel(/^Name$/i),
    page.getByLabel(/Client name/i),
    page.locator('input[aria-label*="Name" i]'),
  ]) {
    const el = sel.first()
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.fill(CLIENT_NAME)
      log('name set')
      break
    }
  }

  // Helper to fill multi URI fields by section
  async function fillUris(sectionRegex, values) {
    // Expand section if collapsed
    const heading = page.getByText(sectionRegex).first()
    if (await heading.isVisible({ timeout: 2000 }).catch(() => false)) {
      await heading.click().catch(() => {})
    }
    for (const value of values) {
      // Try label near section
      const labeled = page.getByLabel(sectionRegex).first()
      if (await labeled.isVisible({ timeout: 800 }).catch(() => false)) {
        await labeled.fill(value)
        await labeled.press('Enter').catch(() => {})
      } else {
        // Click Add URI near the section
        const section = page.locator('div, section, mat-card').filter({ hasText: sectionRegex }).first()
        const add = section.getByRole('button', { name: /Add URI/i }).first()
        if (await add.isVisible({ timeout: 800 }).catch(() => false)) {
          await add.click()
          await page.waitForTimeout(300)
        }
        const inputs = section.locator('input[type="url"], input[type="text"]')
        const n = await inputs.count()
        if (n > 0) {
          await inputs.nth(n - 1).fill(value)
          await inputs.nth(n - 1).press('Enter').catch(() => {})
        } else {
          // global last empty input
          const all = page.locator('input[type="url"], input[type="text"]')
          const c = await all.count()
          if (c > 0) await all.nth(c - 1).fill(value)
        }
      }
      log('uri', value)
      await page.waitForTimeout(250)
    }
  }

  await fillUris(/Authorized JavaScript origin/i, ORIGINS)
  await fillUris(/Authorized redirect URI/i, REDIRECTS)
  await shot(page, 'cdp-filled')

  // Create
  const createBtn = page.getByRole('button', { name: /^(Create|CREATE|Save)$/i }).first()
  if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await createBtn.click()
    log('clicked Create')
  } else {
    log('Create button not found — fill remaining fields and click Create in the UI')
  }

  // Wait for credentials dialog
  const t0 = Date.now()
  let clientId = ''
  let clientSecret = ''
  while (Date.now() - t0 < 180000) {
    const text = await page.locator('body').innerText().catch(() => '')
    clientId = text.match(/[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com/i)?.[0] || ''
    clientSecret = text.match(/GOCSPX-[A-Za-z0-9_-]+/)?.[0] || ''
    if (clientId && clientSecret) break
    // also try existing client list if user navigated
    await page.waitForTimeout(2000)
  }
  await shot(page, 'cdp-result')

  if (!clientId) {
    log('Could not capture Client ID yet.')
    log('In the success dialog, copy Client ID + Secret — paste into tmp/oauth-setup/manual.env as:')
    log('  AUTH_GOOGLE_ID=...')
    log('  AUTH_GOOGLE_SECRET=...')
    // Keep attached — don't close user's browser
    return
  }

  const result = {
    projectId: PROJECT_ID,
    clientName: CLIENT_NAME,
    clientId,
    clientSecret: clientSecret || '',
    origins: ORIGINS,
    redirects: REDIRECTS,
    scopes: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    createdAt: new Date().toISOString(),
  }
  writeFileSync(join(OUT, 'bevel-oauth-client.json'), JSON.stringify(result, null, 2))
  writeFileSync(
    join(OUT, 'bevel-oauth.env'),
    [
      `AUTH_GOOGLE_ID=${clientId}`,
      `AUTH_GOOGLE_SECRET=${clientSecret || ''}`,
      `AUTH_GOOGLE_HD=derozic.com`,
      `AUTH_TRUST_HOST=true`,
      `AUTH_URL=https://bevel.lvh.me`,
      `NEXTAUTH_URL=https://bevel.lvh.me`,
    ].join('\n') + '\n',
  )
  log('SUCCESS client_id=', clientId)
  log('wrote', join(OUT, 'bevel-oauth.env'))

  // Apply into bevel .env
  const envPath = join(process.cwd(), '.env')
  let env = ''
  try {
    env = await import('node:fs').then((fs) => fs.readFileSync(envPath, 'utf8'))
  } catch {
    env = ''
  }
  const set = (text, k, v) => {
    const re = new RegExp(`^${k}=.*$`, 'm')
    const line = `${k}=${v}`
    return re.test(text) ? text.replace(re, line) : text.trimEnd() + '\n' + line + '\n'
  }
  if (clientId) {
    let t = env
    t = set(t, 'AUTH_GOOGLE_ID', clientId)
    if (clientSecret) t = set(t, 'AUTH_GOOGLE_SECRET', clientSecret)
    t = set(t, 'AUTH_GOOGLE_HD', 'derozic.com')
    t = set(t, 'AUTH_TRUST_HOST', 'true')
    t = set(t, 'AUTH_URL', 'https://bevel.lvh.me')
    t = set(t, 'NEXTAUTH_URL', 'https://bevel.lvh.me')
    writeFileSync(envPath, t)
    log('updated .env')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
