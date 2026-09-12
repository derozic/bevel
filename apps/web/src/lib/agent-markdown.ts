/** Markdown → HTML for SOUL.md / SKILL.md dossiers (headings, lists, tables, code). */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(text: string): string {
  let s = escapeHtml(text)
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^\s)]+)\)/g,
    '<a href="$2">$1</a>',
  )
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  return s
}

function isTableSep(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((c) => c.trim())
}

export function markdownToHtml(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  let inList: 'ul' | 'ol' | null = null
  let inCode = false
  const code: string[] = []

  const closeList = () => {
    if (inList) {
      out.push(`</${inList}>`)
      inList = null
    }
  }

  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (inCode) {
      if (line.startsWith('```')) {
        out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
        code.length = 0
        inCode = false
      } else {
        code.push(line)
      }
      i += 1
      continue
    }

    if (line.startsWith('```')) {
      closeList()
      inCode = true
      i += 1
      continue
    }

    if (!line.trim()) {
      closeList()
      i += 1
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      closeList()
      const level = heading[1]!.length
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`)
      i += 1
      continue
    }

    if (line.includes('|') && isTableSep(lines[i + 1] ?? '')) {
      closeList()
      const headers = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && (lines[i] ?? '').includes('|')) {
        rows.push(splitRow(lines[i]!))
        i += 1
      }
      out.push('<table><thead><tr>')
      for (const h of headers) out.push(`<th>${inline(h)}</th>`)
      out.push('</tr></thead><tbody>')
      for (const row of rows) {
        out.push('<tr>')
        for (const cell of row) out.push(`<td>${inline(cell)}</td>`)
        out.push('</tr>')
      }
      out.push('</tbody></table>')
      continue
    }

    const ul = line.match(/^\s*[-*]\s+(.+)$/)
    if (ul) {
      if (inList !== 'ul') {
        closeList()
        out.push('<ul>')
        inList = 'ul'
      }
      out.push(`<li>${inline(ul[1]!)}</li>`)
      i += 1
      continue
    }

    const ol = line.match(/^\s*\d+\.\s+(.+)$/)
    if (ol) {
      if (inList !== 'ol') {
        closeList()
        out.push('<ol>')
        inList = 'ol'
      }
      out.push(`<li>${inline(ol[1]!)}</li>`)
      i += 1
      continue
    }

    closeList()
    out.push(`<p>${inline(line)}</p>`)
    i += 1
  }

  closeList()
  if (inCode) {
    out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
  }
  return out.join('\n')
}

export function linkifyNestedSkills(
  html: string,
  agentId: string,
  known: string[],
): string {
  const id = encodeURIComponent(agentId)
  const set = new Set(known)
  return html.replace(/<code>([a-z0-9/_-]+)<\/code>/g, (match, slug: string) => {
    const path = slug.endsWith('.md') ? slug : `${slug}.md`
    const nested = path.startsWith('skills/') ? path : `skills/${path}`
    if (!set.has(nested) && !set.has(slug)) return match
    const href = `/talk/${id}/skills/${encodeURIComponent(slug.replace(/\.md$/, ''))}`
    return `<a href="${href}" class="agent-doc-ref"><code>${slug}</code></a>`
  })
}
