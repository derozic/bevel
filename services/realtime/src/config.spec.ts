import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isAgentsRepoRoot, resolveAgentsRepoRoot } from './config'

function fakeAgentsTree(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bevel-agents-'))
  mkdirSync(join(dir, 'dist'), { recursive: true })
  mkdirSync(join(dir, 'src', 'agents'), { recursive: true })
  writeFileSync(join(dir, 'dist', 'runner.js'), 'module.exports = {}\n')
  return dir
}

function fakeBevelTreeWithStaleRunner(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bevel-root-'))
  mkdirSync(join(dir, 'dist'), { recursive: true })
  writeFileSync(join(dir, 'dist', 'runner.js'), 'module.exports = {}\n')
  writeFileSync(join(dir, 'registry.json'), '{}\n')
  return dir
}

describe('resolveAgentsRepoRoot', () => {
  it('rejects a Bevel checkout that only has a leftover dist/runner.js', () => {
    const bevel = fakeBevelTreeWithStaleRunner()
    expect(isAgentsRepoRoot(bevel)).toBe(false)
  })

  it('accepts a tree with dist/runner.js and src/agents', () => {
    const agents = fakeAgentsTree()
    expect(isAgentsRepoRoot(agents)).toBe(true)
  })

  it('walks AGENTS_REPO_ROOT/agents when the env root is the Bevel checkout', () => {
    const bevel = fakeBevelTreeWithStaleRunner()
    const agents = fakeAgentsTree()
    // Simulate /opt/bevel + /opt/bevel/agents by placing agents under bevel.
    const nested = join(bevel, 'agents')
    mkdirSync(join(nested, 'dist'), { recursive: true })
    mkdirSync(join(nested, 'src', 'agents'), { recursive: true })
    writeFileSync(join(nested, 'dist', 'runner.js'), 'module.exports = {}\n')

    expect(
      resolveAgentsRepoRoot({
        envRoot: bevel,
        candidates: [agents],
      }),
    ).toBe(nested)
  })
})
