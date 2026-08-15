'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('BEVEL global client error', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          background: '#0c0c0e',
          color: '#f4f4f5',
        }}
      >
        <main
          style={{
            maxWidth: 28 * 16,
            margin: '20vh auto',
            padding: '0 24px',
          }}
        >
          <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>
            BEVEL hit a client error
          </h1>
          <p style={{ color: '#a1a1aa', lineHeight: 1.5, margin: '0 0 20px' }}>
            {error.message || 'Reload the page. If it persists, sign out and back in.'}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: '1px solid #3f3f46',
                background: '#141418',
                color: '#f4f4f5',
                borderRadius: 8,
                padding: '8px 14px',
                fontWeight: 600,
              }}
            >
              Try again
            </button>
            <a
              href="/login?clear=1"
              style={{
                border: '1px solid #3f3f46',
                color: '#f4f4f5',
                borderRadius: 8,
                padding: '8px 14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Clear session
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
