#!/usr/bin/env node
/**
 * Write Tegan sticker-glyph SVGs (CSS variables for day-part contrast)
 * and a bundled glyphs.ts map for inline rendering.
 *
 * Motifs: ~/dev/agents/src/agents/tegan/skills/avatars.md
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const avatarsDir = join(root, 'apps/web/public/avatars')
const glyphsPath = join(root, 'apps/web/src/components/avatars/glyphs.ts')

const P = 'var(--agent-plate, ACCENT)'
const F = 'var(--agent-face, #faf8f5)'
const I = 'var(--agent-ink, ACCENT)'
const S = 'var(--agent-stroke, #ffffff)'
const H = 'var(--agent-highlight, #ffffff)'
const G = 'var(--agent-glyph, #ffffff)'

function svg(accent, label, body) {
  const plate = P.replaceAll('ACCENT', accent)
  const ink = I.replaceAll('ACCENT', accent)
  const inner = body
    .replaceAll('{P}', plate)
    .replaceAll('{F}', F)
    .replaceAll('{I}', ink)
    .replaceAll('{S}', S)
    .replaceAll('{H}', H)
    .replaceAll('{G}', G)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" role="img" aria-label="${label}">
  <rect width="120" height="120" rx="28" fill="${plate}"/>
${inner}
</svg>
`
}

const glyphs = {
  hermes: svg(
    '#0d9488',
    'Hermes',
    `  <ellipse cx="60" cy="54" rx="20" ry="24" fill="{F}" stroke="{S}" stroke-width="3"/>
  <circle cx="52" cy="50" r="3.5" fill="{I}"/>
  <circle cx="68" cy="50" r="3.5" fill="{I}"/>
  <path d="M52 60c4 4 12 4 16 0" stroke="{I}" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M28 42c10-10 22-14 32-14s22 4 32 14" stroke="{H}" stroke-width="3" stroke-linecap="round"/>
  <path d="M80 34l12-10 6 5-10 12z" fill="{H}" stroke="{S}" stroke-width="2" stroke-linejoin="round"/>`,
  ),
  sterling: svg(
    '#d4af37',
    'Sterling',
    `  <rect x="26" y="28" width="68" height="64" rx="10" fill="{F}" stroke="{S}" stroke-width="3"/>
  <rect x="36" y="66" width="11" height="16" rx="2.5" fill="{I}"/>
  <rect x="51" y="54" width="11" height="28" rx="2.5" fill="{I}"/>
  <rect x="66" y="42" width="11" height="40" rx="2.5" fill="{I}"/>
  <circle cx="86" cy="40" r="11" fill="{H}" stroke="{I}" stroke-width="2.5"/>
  <circle cx="86" cy="40" r="5" fill="none" stroke="{I}" stroke-width="2"/>`,
  ),
  mildred: svg(
    '#059669',
    'Mildred',
    `  <rect x="28" y="30" width="64" height="60" rx="8" fill="{F}" stroke="{S}" stroke-width="3"/>
  <path d="M40 48h40M40 60h40M40 72h28" stroke="{I}" stroke-width="4" stroke-linecap="round"/>
  <rect x="68" y="68" width="18" height="14" rx="3" fill="{H}" stroke="{I}" stroke-width="2"/>`,
  ),
  cadence: svg(
    '#6366f1',
    'Cadence',
    `  <path d="M60 22v16" stroke="{S}" stroke-width="4" stroke-linecap="round"/>
  <path d="M48 28l24 8" stroke="{H}" stroke-width="3.5" stroke-linecap="round"/>
  <rect x="36" y="42" width="10" height="52" rx="5" fill="{F}" stroke="{S}" stroke-width="3"/>
  <rect x="55" y="54" width="10" height="40" rx="5" fill="{F}" stroke="{S}" stroke-width="3"/>
  <rect x="74" y="34" width="10" height="60" rx="5" fill="{H}" stroke="{S}" stroke-width="3"/>`,
  ),
  tegan: svg(
    '#ec4899',
    'Tegan',
    `  <rect x="30" y="34" width="60" height="52" rx="10" fill="{F}" stroke="{S}" stroke-width="3"/>
  <path d="M38 48h44M38 60h32M38 72h24" stroke="{I}" stroke-width="5" stroke-linecap="round"/>
  <circle cx="84" cy="36" r="10" fill="{H}" stroke="{S}" stroke-width="3"/>`,
  ),
  spark: svg(
    '#f97316',
    'Spark',
    `  <path d="M60 18l8 28 30 8-30 8-8 28-8-28-30-8 30-8z" fill="{F}" stroke="{S}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M38 38l44 44M82 38L38 82" stroke="{I}" stroke-width="4" stroke-linecap="round"/>`,
  ),
  helm: svg(
    '#2563eb',
    'Helm',
    `  <circle cx="60" cy="60" r="30" fill="none" stroke="{S}" stroke-width="6"/>
  <circle cx="60" cy="60" r="12" fill="{F}" stroke="{S}" stroke-width="3"/>
  <path d="M60 22v16M60 82v16M22 60h16M82 60h16M34 34l12 12M74 74l12 12M86 34L74 46M46 74L34 86" stroke="{H}" stroke-width="5" stroke-linecap="round"/>`,
  ),
  sable: svg(
    '#1a1410',
    'Sable',
    `  <rect x="28" y="32" width="64" height="44" rx="8" fill="{F}" stroke="{S}" stroke-width="3"/>
  <rect x="36" y="40" width="48" height="28" rx="4" fill="{I}"/>
  <circle cx="60" cy="86" r="12" fill="{H}" stroke="{S}" stroke-width="3"/>
  <circle cx="60" cy="86" r="5" fill="none" stroke="{I}" stroke-width="2.5"/>`,
  ),
  argus: svg(
    '#64748b',
    'Argus',
    `  <ellipse cx="60" cy="60" rx="38" ry="26" fill="{F}" stroke="{S}" stroke-width="3"/>
  <ellipse cx="60" cy="60" rx="22" ry="22" fill="{H}" stroke="{I}" stroke-width="3"/>
  <circle cx="60" cy="60" r="10" fill="{I}"/>
  <circle cx="64" cy="56" r="3.5" fill="{S}"/>`,
  ),
  atlas: svg(
    '#78716c',
    'Atlas',
    `  <ellipse cx="60" cy="78" rx="34" ry="12" fill="{H}" stroke="{S}" stroke-width="3"/>
  <ellipse cx="60" cy="62" rx="28" ry="11" fill="{F}" stroke="{S}" stroke-width="3"/>
  <ellipse cx="60" cy="46" rx="20" ry="10" fill="{F}" stroke="{S}" stroke-width="3"/>
  <path d="M48 40c8-10 16-10 24 0" stroke="{I}" stroke-width="3" stroke-linecap="round"/>`,
  ),
  portia: svg(
    '#7c2d12',
    'Portia',
    `  <path d="M60 22v18" stroke="{S}" stroke-width="4" stroke-linecap="round"/>
  <path d="M36 48h48" stroke="{S}" stroke-width="4" stroke-linecap="round"/>
  <circle cx="38" cy="72" r="16" fill="{F}" stroke="{S}" stroke-width="3"/>
  <circle cx="82" cy="72" r="16" fill="{F}" stroke="{S}" stroke-width="3"/>
  <path d="M38 48v8M82 48v8" stroke="{H}" stroke-width="3"/>
  <rect x="54" y="86" width="12" height="14" rx="2" fill="{H}"/>`,
  ),
  haven: svg(
    '#c084fc',
    'Haven',
    `  <path d="M28 86V58c0-18 14-32 32-32s32 14 32 32v28" fill="{F}" stroke="{S}" stroke-width="3"/>
  <rect x="52" y="64" width="16" height="22" rx="3" fill="{I}"/>
  <path d="M24 86h72" stroke="{H}" stroke-width="6" stroke-linecap="round"/>`,
  ),
  veda: svg(
    '#374151',
    'Veda',
    `  <path d="M32 28c0 28 12 48 28 56 16-8 28-28 28-56" fill="{F}" stroke="{S}" stroke-width="3"/>
  <circle cx="60" cy="78" r="14" fill="{H}" stroke="{S}" stroke-width="3"/>
  <path d="M60 72v16M54 84h12" stroke="{I}" stroke-width="3" stroke-linecap="round"/>`,
  ),
  rune: svg(
    '#4c1d95',
    'Rune',
    `  <rect x="24" y="38" width="28" height="44" rx="6" fill="{F}" stroke="{S}" stroke-width="3"/>
  <rect x="68" y="38" width="28" height="44" rx="6" fill="{F}" stroke="{S}" stroke-width="3"/>
  <path d="M52 60h16" stroke="{H}" stroke-width="4" stroke-linecap="round"/>
  <path d="M32 50l6 10-6 10M88 50l-6 10 6 10" stroke="{I}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  grover: svg(
    '#166534',
    'Grover',
    `  <path d="M60 88V42" stroke="{S}" stroke-width="5" stroke-linecap="round"/>
  <path d="M60 58c-14-4-22-16-22-28M60 50c14-2 24-12 26-24" stroke="{H}" stroke-width="4" stroke-linecap="round"/>
  <circle cx="38" cy="28" r="10" fill="{F}" stroke="{S}" stroke-width="3"/>
  <circle cx="86" cy="24" r="9" fill="{F}" stroke="{S}" stroke-width="3"/>
  <circle cx="60" cy="36" r="8" fill="{H}" stroke="{S}" stroke-width="3"/>`,
  ),
  flux: svg(
    '#0891b2',
    'Flux',
    `  <path d="M28 44h28a16 16 0 0 1 16 16 16 16 0 0 0 16 16h20" stroke="{S}" stroke-width="8" stroke-linecap="round" fill="none"/>
  <path d="M28 44h28a16 16 0 0 1 16 16 16 16 0 0 0 16 16h20" stroke="{H}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  <path d="M28 76h20a12 12 0 0 0 12-12 12 12 0 0 1 12-12h36" stroke="{F}" stroke-width="6" stroke-linecap="round" fill="none"/>
  <circle cx="28" cy="44" r="6" fill="{F}"/>
  <circle cx="92" cy="76" r="6" fill="{F}"/>`,
  ),
  johnny: svg(
    '#f59e0b',
    'Johnny',
    `  <path d="M44 78c0-18 7-32 16-32s16 14 16 32" fill="{F}" stroke="{S}" stroke-width="3"/>
  <rect x="42" y="76" width="36" height="10" rx="4" fill="{H}" stroke="{S}" stroke-width="2"/>
  <circle cx="60" cy="40" r="10" fill="{F}" stroke="{S}" stroke-width="3"/>
  <circle cx="82" cy="34" r="10" fill="#22c55e" stroke="{S}" stroke-width="3"/>`,
  ),
  brain: svg(
    '#7c3aed',
    'Brain',
    `  <rect x="30" y="30" width="60" height="16" rx="5" fill="{F}" stroke="{S}" stroke-width="3"/>
  <rect x="34" y="50" width="52" height="16" rx="5" fill="{H}" stroke="{S}" stroke-width="3"/>
  <rect x="38" y="70" width="44" height="16" rx="5" fill="{F}" stroke="{S}" stroke-width="3"/>
  <path d="M42 38h36M46 58h28M50 78h20" stroke="{I}" stroke-width="2.5" stroke-linecap="round"/>`,
  ),
  loom: svg(
    '#0ea5e9',
    'Loom',
    `  <path d="M28 32h64M28 88h64M36 24v72M84 24v72" stroke="{S}" stroke-width="4" stroke-linecap="round"/>
  <path d="M36 44h48M36 60h48M36 76h48" stroke="{H}" stroke-width="5" stroke-linecap="round"/>
  <path d="M48 32v56M68 32v56" stroke="{F}" stroke-width="4" stroke-linecap="round"/>`,
  ),
  continuous: svg(
    '#6366f1',
    'Continuous',
    `  <path d="M28 60c0-12 10-22 22-22 8 0 14 4 18 10 4-6 10-10 18-10 12 0 22 10 22 22s-10 22-22 22c-8 0-14-4-18-10-4 6-10 10-18 10-12 0-22-10-22-22z" fill="none" stroke="{F}" stroke-width="8" stroke-linecap="round"/>
  <path d="M28 60c0-12 10-22 22-22 8 0 14 4 18 10 4-6 10-10 18-10 12 0 22 10 22 22s-10 22-22 22c-8 0-14-4-18-10-4 6-10 10-18 10-12 0-22-10-22-22z" fill="none" stroke="{S}" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="50" cy="60" r="6" fill="{H}"/>
  <circle cx="70" cy="60" r="6" fill="{F}"/>`,
  ),
  northstar: svg(
    '#f59e0b',
    'Northstar',
    `  <path d="M44 88h32L68 52H52z" fill="{F}" stroke="{S}" stroke-width="3" stroke-linejoin="round"/>
  <rect x="56" y="64" width="8" height="12" rx="1.5" fill="{I}"/>
  <path d="M60 18l6 16h18l-14 11 5 17-15-11-15 11 5-17-14-11h18z" fill="{H}" stroke="{S}" stroke-width="2.5" stroke-linejoin="round"/>`,
  ),
  lego: svg(
    '#22c55e',
    'Lego',
    `  <rect x="28" y="44" width="28" height="28" rx="6" fill="{F}" stroke="{S}" stroke-width="3"/>
  <rect x="64" y="44" width="28" height="28" rx="6" fill="{H}" stroke="{S}" stroke-width="3"/>
  <rect x="46" y="72" width="28" height="20" rx="6" fill="{F}" stroke="{S}" stroke-width="3"/>
  <circle cx="42" cy="52" r="4" fill="{I}"/>
  <circle cx="78" cy="52" r="4" fill="{I}"/>`,
  ),
  crucible: svg(
    '#b45309',
    'Crucible',
    `  <path d="M36 28h48v12H36z" fill="{H}" stroke="{S}" stroke-width="3"/>
  <path d="M40 40c2 28 8 40 20 48 12-8 18-20 20-48" fill="{F}" stroke="{S}" stroke-width="3"/>
  <path d="M50 62c4 8 16 8 20 0" stroke="{I}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="60" cy="54" r="5" fill="{I}"/>`,
  ),
  codegraph: svg(
    '#3b82f6',
    'Codegraph',
    `  <circle cx="32" cy="36" r="10" fill="{F}" stroke="{S}" stroke-width="3"/>
  <circle cx="88" cy="36" r="10" fill="{F}" stroke="{S}" stroke-width="3"/>
  <circle cx="60" cy="84" r="12" fill="{H}" stroke="{S}" stroke-width="3"/>
  <circle cx="60" cy="52" r="8" fill="{F}" stroke="{S}" stroke-width="3"/>
  <path d="M40 40l14 8M80 40L66 48M60 60v12" stroke="{S}" stroke-width="3" stroke-linecap="round"/>`,
  ),
  openai: svg(
    '#101010',
    'ChatGPT',
    `  <g fill="{G}" transform="translate(18 18) scale(3.5)">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
  </g>`,
  ),
  claude: svg(
    '#D97757',
    'Claude',
    `  <g fill="{G}" transform="translate(22 18) scale(3.2)">
    <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/>
  </g>`,
  ),
  grok: svg(
    '#111111',
    'Grok',
    `  <g fill="{G}" transform="translate(60 60)">
    <path d="M0-36 L4.2-6.4 L36 0 L4.2 6.4 L0 36 L-4.2 6.4 L-36 0 L-4.2-6.4 Z"/>
    <path d="M0-36 L4.2-6.4 L36 0 L4.2 6.4 L0 36 L-4.2 6.4 L-36 0 L-4.2-6.4 Z" transform="rotate(30)"/>
    <path d="M0-36 L4.2-6.4 L36 0 L4.2 6.4 L0 36 L-4.2 6.4 L-36 0 L-4.2-6.4 Z" transform="rotate(60)"/>
  </g>`,
  ),
}

mkdirSync(avatarsDir, { recursive: true })
mkdirSync(dirname(glyphsPath), { recursive: true })

const ids = Object.keys(glyphs).sort()
for (const id of ids) {
  writeFileSync(join(avatarsDir, `${id}.svg`), glyphs[id])
}

const ts = `/* Generated by scripts/build-agent-glyphs.mjs — do not edit by hand. */
export const AGENT_GLYPHS: Record<string, string> = {
${ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(glyphs[id])},`).join('\n')}
}

export const AGENT_GLYPH_IDS = ${JSON.stringify(ids)} as const
`

writeFileSync(glyphsPath, ts)
console.log(`Wrote ${ids.length} avatars → ${avatarsDir}`)
console.log(`Wrote glyphs map → ${glyphsPath}`)
