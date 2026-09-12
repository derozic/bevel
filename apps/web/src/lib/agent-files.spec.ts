import { describe, expect, it } from 'vitest'
import { markdownToHtml } from './agent-markdown'
import {
  loadAgentDossier,
  sanitizeAgentDocPath,
} from './agent-files'
import { bevelAgentProfilePath, bevelAgentSkillPath, bevelAgentSoulPath } from './bevel'

describe('agent dossier paths', () => {
  it('keeps public talk URLs stable', () => {
    expect(bevelAgentProfilePath('Hermes')).toBe('/talk/hermes/profile')
    expect(bevelAgentSoulPath('hermes')).toBe('/talk/hermes/soul')
    expect(bevelAgentSkillPath('hermes')).toBe('/talk/hermes/skills')
    expect(bevelAgentSkillPath('hermes', 'skills/co-founder.md')).toBe(
      '/talk/hermes/skills/co-founder',
    )
    expect(bevelAgentSkillPath('hermes', 'co-founder')).toBe(
      '/talk/hermes/skills/co-founder',
    )
  })

  it('rejects path traversal', () => {
    expect(sanitizeAgentDocPath('../SOUL.md')).toBeNull()
    expect(sanitizeAgentDocPath('/etc/passwd')).toBeNull()
    expect(sanitizeAgentDocPath('SOUL.md')).toBe('SOUL.md')
    expect(sanitizeAgentDocPath('skills/co-founder.md')).toBe(
      'skills/co-founder.md',
    )
    expect(sanitizeAgentDocPath('hermes-skills/bevel-workspace/SKILL.md')).toBe(
      'hermes-skills/bevel-workspace/SKILL.md',
    )
  })
})

describe('agent markdown', () => {
  it('renders tables used in SOUL.md', () => {
    const html = markdownToHtml(
      '| Director | Domain |\n| --- | --- |\n| **@sterling** | Revenue |',
    )
    expect(html).toContain('<table>')
    expect(html).toContain('<strong>@sterling</strong>')
    expect(html).toContain('<td>Revenue</td>')
  })
})

describe('synced agent files', () => {
  it('loads Hermes soul, skill, and nested skills', () => {
    const dossier = loadAgentDossier('hermes')
    expect(dossier.soul?.path).toBe('SOUL.md')
    expect(dossier.skill?.path).toBe('SKILL.md')
    expect(dossier.soul?.content).toMatch(/Co-Founder/i)
    expect(dossier.files.some((f) => f.path.startsWith('skills/'))).toBe(true)
  })

  it('loads platform backstories', () => {
    expect(loadAgentDossier('openai').soul?.content).toMatch(/OpenAI/)
    expect(loadAgentDossier('claude').soul?.content).toMatch(/Anthropic/)
    expect(loadAgentDossier('grok').soul?.content).toMatch(/xAI/)
  })
})
