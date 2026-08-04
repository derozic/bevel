'use client'

import { useState } from 'react'
import {
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  type MediaPreviewMeta,
  type YoutubeId,
} from '../lib/media-urls'

/**
 * Safe chat image — png/jpg/gif/webp/svg via <img> (never inline SVG).
 */
export function ChatImage({
  src,
  alt = '',
}: {
  src: string
  alt?: string
}) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="fleet-chat-media-link"
      >
        {alt || src}
      </a>
    )
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="fleet-chat-media-image-wrap"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || 'Image'}
        className="fleet-chat-media-image"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </a>
  )
}

/**
 * YouTube embed with click-to-play thumbnail card.
 * Optional `preview` is for 2ndbrain transcript/summary enrichment later.
 */
export function YouTubeEmbed({
  videoId,
  preview,
}: {
  videoId: YoutubeId
  preview?: MediaPreviewMeta | null
}) {
  const [playing, setPlaying] = useState(false)
  const watch = youtubeWatchUrl(videoId)
  const thumb = youtubeThumbnailUrl(videoId)
  const title = preview?.title?.trim() || 'YouTube video'
  const summary = preview?.summary?.trim() || preview?.transcriptSnippet?.trim()

  return (
    <figure
      className="fleet-chat-youtube"
      data-youtube-id={videoId}
      data-preview-source={preview?.source ?? undefined}
    >
      <div className="fleet-chat-youtube-frame">
        {playing ? (
          <iframe
            className="fleet-chat-youtube-iframe"
            src={`${youtubeEmbedUrl(videoId)}&autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            className="fleet-chat-youtube-poster"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb}
              alt=""
              className="fleet-chat-youtube-thumb"
              loading="lazy"
              decoding="async"
            />
            <span className="fleet-chat-youtube-play" aria-hidden>
              <svg viewBox="0 0 68 48" width="68" height="48">
                <path
                  d="M66.52 7.74a8 8 0 0 0-5.64-5.66C56.12 1 34 1 34 1S11.88 1 7.12 2.08A8 8 0 0 0 1.48 7.74C.4 12.5.4 24 .4 24s0 11.5 1.08 16.26a8 8 0 0 0 5.64 5.66C11.88 47 34 47 34 47s22.12 0 26.88-1.08a8 8 0 0 0 5.64-5.66C67.6 35.5 67.6 24 67.6 24s0-11.5-1.08-16.26z"
                  fill="red"
                />
                <path d="M45 24 27 14v20" fill="#fff" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <figcaption className="fleet-chat-youtube-caption">
        <a
          href={watch}
          target="_blank"
          rel="noopener noreferrer"
          className="fleet-chat-youtube-title"
        >
          {title}
        </a>
        {summary ? (
          <p className="fleet-chat-youtube-summary" data-media-preview="2ndbrain">
            {summary}
          </p>
        ) : (
          <p className="fleet-chat-youtube-hint">
            Embed · preview summary via 2ndbrain when linked
          </p>
        )}
      </figcaption>
    </figure>
  )
}
