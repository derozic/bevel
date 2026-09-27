import type { ReactNode } from 'react'
import { parseNugget } from '@bevel/schema'
import { NuggetCard } from '../components/NuggetCard'
import { LinkPreviewCard } from '../components/LinkPreviewCard'
import { extractChatImages } from './chat-images'
import { firstHttpUrl } from './link-preview'

const FENCE_RE = /^```/
const LIST_RE = /^[-•*]\s+/
const MENTION_LINE_RE = /^[@^][a-zA-Z0-9_-]+/
const CODEISH_RE =
  /^(import\s|from\s|def\s|class\s|const\s|let\s|var\s|export\s|return\s|if\s|elif\s|else:|for\s|while\s|try:|except\s|with\s|#include\s|package\s|fn\s|pub\s|using\s|print\(|console\.|\{|\}|<\/|[\]];?$|\t| {2,}|[a-zA-Z_][\w.]*\()/

/**
 * Split inline text into code, bold, @soft-mentions, and ^escalations.
 * @handle → person soft mention (timeline feed, no full notify)
 * ^handle → escalation (full notify + personal agent)
 */
function inlineFormat(text: string, keyPrefix: string): ReactNode[] {
  const segments = text.split(
    /(`[^`]+`|\*\*[^*]+\*\*|@[a-zA-Z0-9_-]+|\^[a-zA-Z0-9_-]+|https?:\/\/[^\s<>"']+)/g,
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
      if (/^https?:\/\//i.test(seg)) {
        const href = seg.replace(/[),.]+$/, '')
        return (
          <a
            key={`${keyPrefix}-u-${i}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="fleet-chat-link"
          >
            {href}
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

function ChatImageStrip({
  images,
}: {
  images: Array<{ alt: string; src: string; kind: 'image' | 'video' }>
}) {
  if (images.length === 0) return null
  return (
    <div className="fleet-chat-msg-images">
      {images.map((img) =>
        img.kind === 'video' ? (
          <video
            key={img.src}
            className="fleet-chat-msg-video"
            src={img.src}
            controls
            playsInline
            preload="metadata"
          >
            {img.alt}
          </video>
        ) : (
          <a
            key={img.src}
            href={img.src}
            target="_blank"
            rel="noreferrer"
            className="fleet-chat-msg-image-link"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={img.alt} className="fleet-chat-msg-image" />
          </a>
        ),
      )}
    </div>
  )
}

/** Lightweight chat markdown — lists, bold, code, @mentions, ^escalations, images. */
export function ChatMessageBody({ text }: { text: string }) {
  const safe = typeof text === 'string' ? text : text == null ? '' : String(text)
  const nugget = parseNugget(safe)
  if (nugget) return <NuggetCard nugget={nugget} />
  const { body, images } = extractChatImages(safe)
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const nodes: ReactNode[] = []
  let listItems: ReactNode[] = []
  let codeLines: string[] = []
  let inFence = false
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

  const flushCode = () => {
    if (codeLines.length === 0) return
    nodes.push(
      <pre key={`pre-${block++}`} className="fleet-chat-pre">
        <code>{codeLines.join('\n')}</code>
      </pre>,
    )
    codeLines = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (FENCE_RE.test(trimmed)) {
      flushList()
      if (inFence) {
        flushCode()
        inFence = false
      } else {
        flushCode()
        inFence = true
      }
      continue
    }

    if (inFence) {
      codeLines.push(line)
      continue
    }

    if (!trimmed) {
      flushList()
      flushCode()
      continue
    }

    if (CODEISH_RE.test(line) || CODEISH_RE.test(trimmed)) {
      flushList()
      codeLines.push(line)
      continue
    }

    flushCode()

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
    const onlyUrl = firstHttpUrl(trimmed)
    if (onlyUrl && !/\s/.test(trimmed)) {
      nodes.push(<LinkPreviewCard key={`link-${i}`} url={onlyUrl} />)
      continue
    }
    nodes.push(
      <p key={`p-${i}`} className="fleet-chat-paragraph">
        {inlineFormat(line, `p-${i}`)}
      </p>,
    )
  }

  flushList()
  flushCode()

  if (nodes.length === 0 && images.length === 0) {
    return <p className="fleet-chat-paragraph">{text}</p>
  }

  return (
    <div className="fleet-chat-formatted">
      <ChatImageStrip images={images} />
      {nodes}
    </div>
  )
}
