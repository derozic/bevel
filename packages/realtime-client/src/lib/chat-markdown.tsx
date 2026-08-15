import type { ReactNode } from 'react'

const FENCE_RE = /^```/
const LIST_RE = /^[-•*]\s+/
const MENTION_LINE_RE = /^[@^][a-zA-Z0-9_-]+/

/**
 * Split inline text into code, bold, @soft-mentions, and ^escalations.
 * @handle → person soft mention (timeline feed, no full notify)
 * ^handle → escalation (full notify + personal agent)
 */
function inlineFormat(text: string, keyPrefix: string): ReactNode[] {
  const segments = text.split(
    /(`[^`]+`|\*\*[^*]+\*\*|@[a-zA-Z0-9_-]+|\^[a-zA-Z0-9_-]+)/g,
  )
  return segments
    .filter((seg) => seg.length > 0)
    .map((seg, i) => {
      if (seg.startsWith('`') && seg.endsWith('`')) {
        return (
          <code key={`${keyPrefix}-c-${i}`} className="fleet-chat-code">
            {seg.slice(1, -1)}
          </code>
        )
      }
      if (seg.startsWith('**') && seg.endsWith('**')) {
        return (
          <strong key={`${keyPrefix}-b-${i}`} className="fleet-chat-strong">
            {seg.slice(2, -2)}
          </strong>
        )
      }
      if (seg.startsWith('@') && /^@[a-zA-Z0-9_-]+$/.test(seg)) {
        const handle = seg.slice(1)
        return (
          <a
            key={`${keyPrefix}-m-${i}`}
            href={`/u/${encodeURIComponent(handle.toLowerCase())}`}
            className="fleet-chat-mention fleet-chat-mention--soft"
            data-mention="soft"
            data-handle={handle.toLowerCase()}
            title={`@${handle} — soft mention (timeline)`}
          >
            {seg}
          </a>
        )
      }
      if (seg.startsWith('^') && /^\^[a-zA-Z0-9_-]+$/.test(seg)) {
        const handle = seg.slice(1)
        return (
          <a
            key={`${keyPrefix}-e-${i}`}
            href={`/u/${encodeURIComponent(handle.toLowerCase())}`}
            className="fleet-chat-mention fleet-chat-mention--escalation"
            data-mention="escalation"
            data-handle={handle.toLowerCase()}
            title={`^${handle} — escalation (notify + personal agent)`}
          >
            {seg}
          </a>
        )
      }
      return <span key={`${keyPrefix}-t-${i}`}>{seg}</span>
    })
}

/** Lightweight chat markdown — lists, bold, code, @mentions, ^escalations. */
export function ChatMessageBody({ text }: { text: string }) {
  const safe = typeof text === 'string' ? text : text == null ? '' : String(text)
  const lines = safe.replace(/\r\n/g, '\n').split('\n')
  const nodes: ReactNode[] = []
  let listItems: ReactNode[] = []
  let block = 0

  const flushList = () => {
    if (listItems.length === 0) return
    nodes.push(
      <ul key={`list-${block++}`} className="fleet-chat-list">
        {listItems}
      </ul>,
    )
    listItems = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed || FENCE_RE.test(trimmed) || trimmed === 'text') {
      if (FENCE_RE.test(trimmed) || trimmed === 'text') continue
      flushList()
      continue
    }

    if (LIST_RE.test(trimmed) || MENTION_LINE_RE.test(trimmed)) {
      const content = LIST_RE.test(trimmed)
        ? trimmed.replace(LIST_RE, '')
        : trimmed
      listItems.push(
        <li key={`li-${i}`} className="fleet-chat-list-item">
          {inlineFormat(content, `li-${i}`)}
        </li>,
      )
      continue
    }

    flushList()
    nodes.push(
      <p key={`p-${i}`} className="fleet-chat-paragraph">
        {inlineFormat(line, `p-${i}`)}
      </p>,
    )
  }

  flushList()

  if (nodes.length === 0) {
    return <p className="fleet-chat-paragraph">{text}</p>
  }

  return <div className="fleet-chat-formatted">{nodes}</div>
}
