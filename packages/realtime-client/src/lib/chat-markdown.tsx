import type { ReactNode } from 'react'
import { BevelChart, parseBevelChartSpec } from '@bevel/charts'
import type { BevelChartSpec } from '@bevel/schema'
import { ChatImage, YouTubeEmbed } from '../components/ChatMedia'
import {
  parseStandaloneMediaLine,
  splitInlineMedia,
  type MediaPreviewMeta,
} from './media-urls'

const FENCE_RE = /^```/
const LIST_RE = /^[-•*]\s+/
const MENTION_LINE_RE = /^[@^][a-zA-Z0-9_-]+/
const CHART_FENCE_LANG = /^(bevel-chart|chart|bevel_chart)\b/i

type MessageBlock =
  | { kind: 'text'; value: string }
  | { kind: 'chart'; spec: BevelChartSpec }
  | { kind: 'code'; lang: string; body: string }

/**
 * Split message into text / chart / code fence blocks.
 * Chart fences: ```bevel-chart | ```chart with JSON body.
 */
export function splitMessageBlocks(text: string): MessageBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: MessageBlock[] = []
  let i = 0
  let textBuf: string[] = []

  const flushText = () => {
    if (textBuf.length === 0) return
    blocks.push({ kind: 'text', value: textBuf.join('\n') })
    textBuf = []
  }

  while (i < lines.length) {
    const line = lines[i]!
    const fence = line.trim().match(/^```\s*([^\s`]*)/)
    if (fence) {
      flushText()
      const lang = (fence[1] || '').trim()
      i += 1
      const bodyLines: string[] = []
      while (i < lines.length && !FENCE_RE.test(lines[i]!.trim())) {
        bodyLines.push(lines[i]!)
        i += 1
      }
      if (i < lines.length && FENCE_RE.test(lines[i]!.trim())) i += 1
      const body = bodyLines.join('\n').trim()
      if (CHART_FENCE_LANG.test(lang)) {
        try {
          const json = JSON.parse(body) as unknown
          const spec = parseBevelChartSpec(json)
          if (spec) {
            blocks.push({ kind: 'chart', spec })
            continue
          }
        } catch {
          /* fall through to code */
        }
      }
      blocks.push({ kind: 'code', lang: lang || 'text', body })
      continue
    }
    textBuf.push(line)
    i += 1
  }
  flushText()
  return blocks.length > 0 ? blocks : [{ kind: 'text', value: text }]
}

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

function renderTextBlock(
  text: string,
  keyPrefix: string,
  agentIds?: Set<string>,
  mediaPreviews?: Record<string, MediaPreviewMeta>,
): ReactNode[] {
  const lines = text.split('\n')
  const nodes: ReactNode[] = []
  let listItems: ReactNode[] = []
  let block = 0

  const flushList = () => {
    if (listItems.length === 0) return
    nodes.push(
      <ul key={`${keyPrefix}-list-${block++}`} className="fleet-chat-list">
        {listItems}
      </ul>,
    )
    listItems = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      continue
    }

    const standalone = parseStandaloneMediaLine(trimmed)
    if (standalone) {
      flushList()
      if (standalone.kind === 'image') {
        nodes.push(
          <div key={`${keyPrefix}-media-${i}`} className="fleet-chat-media-block">
            <ChatImage src={standalone.url} alt={standalone.alt} />
          </div>,
        )
      } else {
        nodes.push(
          <div key={`${keyPrefix}-media-${i}`} className="fleet-chat-media-block">
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
        <li key={`${keyPrefix}-li-${i}`} className="fleet-chat-list-item">
          {inlineFormat(content, `${keyPrefix}-li-${i}`, agentIds, mediaPreviews)}
        </li>,
      )
      continue
    }

    flushList()
    nodes.push(
      <p key={`${keyPrefix}-p-${i}`} className="fleet-chat-paragraph">
        {inlineFormat(line, `${keyPrefix}-p-${i}`, agentIds, mediaPreviews)}
      </p>,
    )
  }

  flushList()
  return nodes
}

/**
 * Lightweight chat markdown — lists, bold, code, @mentions, media embeds,
 * and agent-emitted ```bevel-chart``` D3 visuals (token spend, gantt, etc.).
 */
export function ChatMessageBody({
  text,
  agentIds,
  mediaPreviews,
}: {
  text: string
  agentIds?: Set<string>
  mediaPreviews?: Record<string, MediaPreviewMeta>
}) {
  const blocks = splitMessageBlocks(text)
  const nodes: ReactNode[] = []

  blocks.forEach((block, bi) => {
    if (block.kind === 'chart') {
      nodes.push(
        <div key={`chart-${bi}`} className="fleet-chat-chart-block">
          <BevelChart spec={block.spec} />
        </div>,
      )
      return
    }
    if (block.kind === 'code') {
      nodes.push(
        <pre key={`code-${bi}`} className="fleet-chat-code-block">
          <code data-lang={block.lang || undefined}>{block.body}</code>
        </pre>,
      )
      return
    }
    nodes.push(
      ...renderTextBlock(block.value, `t${bi}`, agentIds, mediaPreviews),
    )
  })

  if (nodes.length === 0) {
    return <p className="fleet-chat-paragraph">{text}</p>
  }

  return <div className="fleet-chat-formatted">{nodes}</div>
}
