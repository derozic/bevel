import { describe, expect, it } from 'vitest'
import {
  chatImageMarkdown,
  extractChatImages,
  hasChatImageMarkdown,
  isSafeChatImageSrc,
} from './chat-images'

describe('chat images', () => {
  it('only allows same-origin uploaded chat image URLs', () => {
    expect(isSafeChatImageSrc('/api/chat/images/abc123def456.png')).toBe(true)
    expect(isSafeChatImageSrc('/api/chat/images/abc123def456.JPEG')).toBe(true)
    expect(isSafeChatImageSrc('https://evil.example/x.png')).toBe(false)
    expect(isSafeChatImageSrc('javascript:alert(1)')).toBe(false)
    expect(isSafeChatImageSrc('/api/chat/images/../secret.png')).toBe(false)
    expect(isSafeChatImageSrc('/api/chat/images/abc.svg')).toBe(false)
  })

  it('lifts markdown images out of the message body', () => {
    const src = '/api/chat/images/aa11bb22cc33.png'
    const { body, images } = extractChatImages(
      `look\n\n${chatImageMarkdown('shot.png', src)}\n`,
    )
    expect(body).toBe('look')
    expect(images).toEqual([{ alt: 'shot.png', src }])
    expect(hasChatImageMarkdown(`x ${chatImageMarkdown('a', src)}`)).toBe(true)
  })

  it('leaves unsafe markdown images in the body', () => {
    const { body, images } = extractChatImages('![x](https://evil.example/a.png)')
    expect(images).toEqual([])
    expect(body).toContain('https://evil.example/a.png')
  })
})
