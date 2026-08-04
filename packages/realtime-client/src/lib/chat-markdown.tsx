import type { ReactNode } from 'react'
import { ChatImage, YouTubeEmbed } from '../components/ChatMedia'
import {
  parseStandaloneMediaLine,
  splitInlineMedia,
  type MediaPreviewMeta,
} from './media-urls'

const FENCE_RE = /^```/
const LIST_RE = /^[-•*]\s+/
const MENTION_LINE_RE = /^[@^][a-zA-Z0-9_-]+/

/**
 * Split inline text into code, bold, @soft-mentions, and ^escalations.
 * @handle → person soft mention (timeline feed, no full notify)
 * @agent → verified fleet agent (stronger chip when agentIds provided)
 * ^handle → escalation (full notify + personal agent)
 */
function formatTextSegments(
  text: string,
  keyPrefix: string,
  agentIds?: Set<string>,
): ReactNode[] {
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
        const lower = handle.toLowerCase()
        const isAgent = agentIds?.has(lower)
        return (
          <a
            key={`${keyPrefix}-m-${i}`}
            href={
              isAgent
                ? `#agent-${encodeURIComponent(lower)}`
                : `/u/${encodeURIComponent(lower)}`
            }
            className={
              isAgent
                ? 'fleet-chat-mention fleet-chat-mention--agent'
                : 'fleet-chat-mention fleet-chat-mention--soft'
            }
            data-mention={isAgent ? 'agent' : 'soft'}
            data-handle={lower}
            title={
              isAgent
                ? `@${handle} — fleet agent`
                : `@${handle} — soft mention (timeline)`
            }
            onClick={isAgent ? (e) => e.preventDefault() : undefined}
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

function inlineFormat(
  text: string,
  keyPrefix: string,
  agentIds?: Set<string>,
  mediaPreviews?: Record<string, MediaPreviewMeta>,
): ReactNode[] {
  const mediaParts = splitInlineMedia(text)
  // Pure text path (no URLs) keeps previous behavior
  if (mediaParts.length === 1 && mediaParts[0]!.type === 'text') {
    return formatTextSegments(mediaParts[0]!.value, keyPrefix, agentIds)
  }

  const out: ReactNode[] = []
  mediaParts.forEach((part, i) => {
    const k = `${keyPrefix}-mp-${i}`
    if (part.type === 'text') {
      out.push(...formatTextSegments(part.value, k, agentIds))
      return
    }
    if (part.type === 'image') {
      out.push(
        <span key={k} className="fleet-chat-media-inline">
          <ChatImage src={part.url} alt={part.alt} />
        </span>,
      )
      return
    }
    if (part.type === 'youtube') {
      out.push(
        <YouTubeEmbed
          key={k}
          videoId={part.videoId}
          preview={mediaPreviews?.[part.videoId]}
        />,
      )
      return
    }
    if (part.type === 'link') {
      out.push(
        <a
          key={k}
          href={part.url}
          target="_blank"
          rel="noopener noreferrer"
          className="fleet-chat-media-link"
        >
          {part.label}
        </a>,
      )
    }
  })
  return out
}

/**
 * Lightweight chat markdown — lists, bold, code, @mentions, media embeds.
 * Images: bare https …png/jpg/svg… or ![alt](url)
 * Video: YouTube URLs → privacy-enhanced embed (2ndbrain previews via mediaPreviews)
 */
export function ChatMessageBody({
  text,
  agentIds,
  mediaPreviews,
}: {
  text: string
  /** Lowercase agent ids treated as verified fleet mentions */
  agentIds?: Set<string>
  /**
   * Optional map of YouTube videoId → title/summary from 2ndbrain
   * (transcript + summarization pipeline).
   */
  mediaPreviews?: Record<string, MediaPreviewMeta>
}) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
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
    const line = lines[i]!
    const trimmed = line.trim()

    if (!trimmed || FENCE_RE.test(trimmed) || trimmed === 'text') {
      if (FENCE_RE.test(trimmed) || trimmed === 'text') continue
      flushList()
      continue
    }

    // Standalone media line → full-width embed
    const standalone = parseStandaloneMediaLine(trimmed)
    if (standalone) {
      flushList()
      if (standalone.kind === 'image') {
        nodes.push(
          <div key={`media-${i}`} className="fleet-chat-media-block">
            <ChatImage src={standalone.url} alt={standalone.alt} />
          </div>,
        )
      } else {
        nodes.push(
          <div key={`media-${i}`} className="fleet-chat-media-block">
            <YouTubeEmbed
              videoId={standalone.videoId}
              preview={mediaPreviews?.[standalone.videoId]}
            />
          </div>,
        )
      }
      continue
    }

    if (LIST_RE.test(trimmed) || MENTION_LINE_RE.test(trimmed)) {
      const content = LIST_RE.test(trimmed)
        ? trimmed.replace(LIST_RE, '')
        : trimmed
      listItems.push(
        <li key={`li-${i}`} className="fleet-chat-list-item">
          {inlineFormat(content, `li-${i}`, agentIds, mediaPreviews)}
        </li>,
      )
      continue
    }

    flushList()
    nodes.push(
      <p key={`p-${i}`} className="fleet-chat-paragraph">
        {inlineFormat(line, `p-${i}`, agentIds, mediaPreviews)}
      </p>,
    )
  }

  flushList()

  if (nodes.length === 0) {
    return <p className="fleet-chat-paragraph">{text}</p>
  }

  return <div className="fleet-chat-formatted">{nodes}</div>
}
