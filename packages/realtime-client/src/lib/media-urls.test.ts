/**
 * Run: pnpm exec tsx packages/realtime-client/src/lib/media-urls.test.ts
 */
import assert from 'node:assert/strict'
import {
  extractYoutubeId,
  isImageUrl,
  isSafeMediaSrc,
  parseMarkdownImageLine,
  parseStandaloneMediaLine,
  splitInlineMedia,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
} from './media-urls'

// Images
assert.equal(isImageUrl('https://cdn.example.com/shot.png'), true)
assert.equal(isImageUrl('https://cdn.example.com/shot.PNG?w=800'), true)
assert.equal(isImageUrl('https://cdn.example.com/shot.jpg'), true)
assert.equal(isImageUrl('https://cdn.example.com/shot.jpeg'), true)
assert.equal(isImageUrl('https://cdn.example.com/icon.svg'), true)
assert.equal(isImageUrl('https://cdn.example.com/a.webp'), true)
assert.equal(isImageUrl('/uploads/brand/logo.png'), true)
assert.equal(isImageUrl('https://example.com/page'), false)
assert.equal(isImageUrl('javascript:alert(1)'), false)
assert.equal(isSafeMediaSrc('//evil.com/x.png'), false)

// Markdown image line
const md = parseMarkdownImageLine('![diagram](https://x.test/a.png)')
assert.ok(md)
assert.equal(md!.alt, 'diagram')
assert.equal(md!.url, 'https://x.test/a.png')

// YouTube ids
assert.equal(
  extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  'dQw4w9WgXcQ',
)
assert.equal(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
assert.equal(
  extractYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'),
  'dQw4w9WgXcQ',
)
assert.equal(
  extractYoutubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'),
  'dQw4w9WgXcQ',
)
assert.equal(extractYoutubeId('https://example.com/watch?v=nope'), null)

assert.ok(youtubeEmbedUrl('dQw4w9WgXcQ').includes('youtube-nocookie.com'))
assert.ok(youtubeThumbnailUrl('dQw4w9WgXcQ').includes('i.ytimg.com'))

// Standalone lines
const yt = parseStandaloneMediaLine('https://youtu.be/dQw4w9WgXcQ')
assert.equal(yt?.kind, 'youtube')
if (yt?.kind === 'youtube') assert.equal(yt.videoId, 'dQw4w9WgXcQ')

const img = parseStandaloneMediaLine('https://cdn.example.com/x.jpg')
assert.equal(img?.kind, 'image')

const mdLine = parseStandaloneMediaLine('![hi](https://cdn.example.com/x.png)')
assert.equal(mdLine?.kind, 'image')

// Inline split
const parts = splitInlineMedia(
  'see https://youtu.be/dQw4w9WgXcQ and ![a](https://x.test/a.png) ok',
)
assert.ok(parts.some((p) => p.type === 'youtube'))
assert.ok(parts.some((p) => p.type === 'image'))
assert.ok(parts.some((p) => p.type === 'text'))

console.log('media-urls.test.ts: ok')
