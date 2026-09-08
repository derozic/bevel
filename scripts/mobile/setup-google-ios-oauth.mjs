/**
 * Create BEVEL iOS OAuth client in GCP project x4m-493516 (type iOS, not WEB).
 *
 *   node scripts/mobile/setup-google-ios-oauth.mjs
 *
 * Opens visible Chromium with persistent profile. Sign in as scott@derozic.com
 * if prompted. On success writes tmp/oauth-setup/bevel-ios-oauth-client.json
 * and runs apply-google-ios-client.sh.
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'x4m-493516'
const CLIENT_NAME = process.env.BEVEL_IOS_OAUTH_NAME || 'BEVEL iOS'
const BUNDLE_ID = process.env.BEVEL_IOS_BUNDLE_ID || 'com.derozic.bevel.bevelApp'
const LOGIN_EMAIL = process.env.GCP_LOGIN_EMAIL || 'scott@derozic.com'

const OUT_DIR = join(ROOT, 'tmp', 'oauth-setup')
const PROFILE_DIR = join(ROOT, 'tmp', 'chrome-cloud-profile')
mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(PROFILE_DIR, { recursive: true })

const log = (...a) => console.log('[bevel-ios-oauth]', ...a)

async function shot(page, name) {
  const path = join(OUT_DIR, `ios-${name}.png`)
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
    const email = page.locator('input[type="email"]').first()
    if (await email.isVisible({ timeout: 400 }).catch(() => false)) {
      const v = await email.inputValue().catch(() => '')
      if (!v) {
        await email.fill(LOGIN_EMAIL)
        log('prefilled login email', LOGIN_EMAIL)
      }
      const next = page.getByRole('button', { name: /Next/i }).first()
      if (await next.isVisible().catch(() => false)) {
        // Do not auto-submit password/passkey — user completes auth
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

async function clickText(page, patterns) {
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
  return false
}

function extractClientIds(body) {
  const re = /[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com/gi
  return [...new Set(body.match(re) || [])]
}

function writeResult(result) {
  writeFileSync(
    join(OUT_DIR, 'bevel-ios-oauth-client.json'),
    JSON.stringify(result, null, 2),
  )
  writeFileSync(
    join(OUT_DIR, 'bevel-ios-oauth.env'),
    [
      `GOOGLE_IOS_CLIENT_ID=${result.clientId}`,
      `GOOGLE_SERVER_CLIENT_ID=336973686985-0ggvfg30mh3junprhcfmdgdtepbnqfb0.apps.googleusercontent.com`,
      `GOOGLE_REVERSED_CLIENT_ID=com.googleusercontent.apps.${result.clientId.replace('.apps.googleusercontent.com', '')}`,
    ].join('\n') + '\n',
  )
  log('wrote', join(OUT_DIR, 'bevel-ios-oauth-client.json'))
}

async function findExistingIosClient(page) {
  log('Scanning credentials for existing iOS client…')
  const urls = [
    `https://console.cloud.google.com/auth/clients?project=${PROJECT_ID}`,
    `https://console.cloud.google.com/apis/credentials?project=${PROJECT_ID}`,
  ]
  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    if (!(await ensureConsole(page, 90_000))) continue
    await shot(page, 'clients-list')
    const body = await page.locator('body').innerText().catch(() => '')
    // Prefer a client named BEVEL iOS / matching bundle notes
    if (
      /BEVEL iOS|bevelApp|iOS client/i.test(body) &&
      /apps\.googleusercontent\.com/i.test(body)
    ) {
      // Click into BEVEL iOS row if present
      const row = page.getByText(/BEVEL iOS/i).first()
      if (await row.isVisible({ timeout: 1500 }).catch(() => false)) {
        await row.click().catch(() => {})
        await page.waitForTimeout(2500)
        await shot(page, 'existing-detail')
        const detail = await page.locator('body').innerText().catch(() => '')
        const ids = extractClientIds(detail)
        if (ids[0]) {
          log('found existing BEVEL iOS client', ids[0])
          return ids[0]
        }
      }
    }
  }
  return null
}

async function createIosClient(page) {
  log('Create OAuth iOS client')
  const urls = [
    `https://console.cloud.google.com/auth/clients/create?project=${PROJECT_ID}`,
    `https://console.cloud.google.com/apis/credentials/oauthclient?project=${PROJECT_ID}`,
  ]

  for (const url of urls) {
    log('goto', url)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    if (!(await ensureConsole(page, 120_000))) continue
    await shot(page, 'create-start')

    // Application type iOS
    const ios = page.getByText(/^iOS$/i).or(page.getByText(/iOS/i)).first()
    // Prefer radio / list item labeled iOS
    const iosExact = page.getByRole('radio', { name: /iOS/i }).first()
    if (await iosExact.isVisible({ timeout: 2000 }).catch(() => false)) {
      await iosExact.click()
      log('selected iOS radio')
    } else if (await ios.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ios.click()
      log('clicked iOS text')
    } else {
      await clickText(page, [/Application type/i, /Select application type/i])
      await page.waitForTimeout(500)
      const picked = await clickText(page, [/^iOS$/i, /iOS client/i, /iPhone/i])
      if (!picked) {
        // Try material option list
        const opt = page.locator('[role="option"]', { hasText: /iOS/i }).first()
        if (await opt.isVisible({ timeout: 1500 }).catch(() => false)) {
          await opt.click()
        } else {
          log('could not find iOS type control on', url)
          await shot(page, 'no-ios-type')
          continue
        }
      }
    }
    await page.waitForTimeout(800)
    await shot(page, 'type-ios')

    // Name
    const nameInput = page
      .getByLabel(/^Name$/i)
      .or(page.locator('input[aria-label*="Name" i]'))
      .or(page.getByPlaceholder(/Name/i))
      .first()
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill(CLIENT_NAME)
      log('filled name', CLIENT_NAME)
    }

    // Bundle ID
    const bundleInput = page
      .getByLabel(/Bundle ID/i)
      .or(page.getByLabel(/Bundle id/i))
      .or(page.locator('input[aria-label*="Bundle" i]'))
      .or(page.getByPlaceholder(/com\.example/i))
      .first()
    if (await bundleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bundleInput.fill(BUNDLE_ID)
      log('filled bundle id', BUNDLE_ID)
    } else {
      // Last text input often is bundle id after name
      const inputs = page.locator('input[type="text"], input:not([type])')
      const n = await inputs.count()
      log('bundle field not labeled; text inputs=', n)
      if (n >= 2) {
        await inputs.nth(1).fill(BUNDLE_ID)
      } else if (n === 1) {
        // name already filled; try another field
        await inputs.nth(0).fill(CLIENT_NAME)
      }
    }

    await shot(page, 'create-filled')
    await clickText(page, [/^Create$/i, /^CREATE$/i, /^Save$/i])
    await page.waitForTimeout(4000)
    await shot(page, 'create-result')

    const body = await page.locator('body').innerText().catch(() => '')
    const ids = extractClientIds(body)
    // Prefer a newly shown client id that is NOT the known WEB client
    const WEB = '336973686985-0ggvfg30mh3junprhcfmdgdtepbnqfb0.apps.googleusercontent.com'
    const clientId = ids.find((id) => id !== WEB) || ids[0]
    if (clientId) {
      writeResult({
        projectId: PROJECT_ID,
        clientName: CLIENT_NAME,
        clientId,
        bundleId: BUNDLE_ID,
        type: 'ios',
        createdAt: new Date().toISOString(),
      })
      return clientId
    }
    log('no client id on create result page; body snippet:', body.slice(0, 400))
  }
  return null
}

function applyClient(clientId) {
  log('Applying client via apply-google-ios-client.sh')
  execSync(`bash scripts/mobile/apply-google-ios-client.sh "${clientId}"`, {
    cwd: ROOT,
    stdio: 'inherit',
  })
}

async function main() {
  // Resume from prior run if present
  const prior = join(OUT_DIR, 'bevel-ios-oauth-client.json')
  if (existsSync(prior) && !process.env.FORCE_CREATE) {
    try {
      const j = JSON.parse(readFileSync(prior, 'utf8'))
      if (j.clientId?.endsWith('.apps.googleusercontent.com')) {
        log('reusing prior client', j.clientId)
        applyClient(j.clientId)
        console.log('\nOK', j.clientId)
        process.exit(0)
      }
    } catch {
      /* continue */
    }
  }

  log('project', PROJECT_ID)
  log('bundle', BUNDLE_ID)
  log('profile', PROFILE_DIR)

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    devtools: true,
    slowMo: 40,
    viewport: { width: 1440, height: 1000 },
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const page = context.pages()[0] || (await context.newPage())
  page.setDefaultTimeout(45_000)

  try {
    await page.goto(
      `https://console.cloud.google.com/auth/clients?project=${PROJECT_ID}`,
      { waitUntil: 'domcontentloaded' },
    )
    log('Waiting for Cloud Console login if needed (complete passkey/password in the browser)…')
    if (!(await ensureConsole(page, 300_000))) {
      throw new Error('Timed out waiting for Google Cloud Console login')
    }
    log('Console ready')

    let clientId = await findExistingIosClient(page)
    if (!clientId) {
      clientId = await createIosClient(page)
    }
    if (!clientId) {
      // One more scan after create attempts
      clientId = await findExistingIosClient(page)
    }
    if (!clientId) {
      await shot(page, 'failed')
      throw new Error(
        'Could not create or find iOS OAuth client. Create manually: ' +
          `https://console.cloud.google.com/apis/credentials?project=${PROJECT_ID} ` +
          `(type iOS, bundle ${BUNDLE_ID}) then: ` +
          './scripts/mobile/apply-google-ios-client.sh <client-id>',
      )
    }

    applyClient(clientId)
    console.log('\nOK GOOGLE_IOS_CLIENT_ID=' + clientId)
    // Keep browser open briefly so user can see success
    await page.waitForTimeout(3000)
  } finally {
    await context.close().catch(() => {})
  }
}

main().catch((e) => {
  console.error('[bevel-ios-oauth] FAIL', e.message || e)
  process.exit(1)
})
