'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { LiveProbeGraph } from './LiveProbeGraph'

export function RealtimeLiveDialog({
  target,
  onClose,
  initialLatencyMs,
  publicUrl,
  id,
}: {
  target: string
  onClose: () => void
  initialLatencyMs?: number
  publicUrl?: string
  id?: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const panelId = useId()
  const [full, setFull] = useState(false)

  useEffect(() => {
    const node = dialogRef.current
    if (!node) return
    if (!node.open) node.showModal()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const node = dialogRef.current
    if (!node) return
    const onCancel = (event: Event) => {
      event.preventDefault()
      if (document.fullscreenElement) {
        void document.exitFullscreen()
        setFull(false)
        return
      }
      onClose()
    }
    node.addEventListener('cancel', onCancel)
    return () => node.removeEventListener('cancel', onCancel)
  }, [onClose])

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === dialogRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFull = useCallback(() => {
    const node = dialogRef.current
    if (!node) return
    if (document.fullscreenElement === node) {
      void document.exitFullscreen()
      setFull(false)
      return
    }
    const req = node.requestFullscreen?.bind(node)
    if (req) {
      void req().then(() => setFull(true)).catch(() => setFull(true))
      return
    }
    setFull((v) => !v)
  }, [])

  return (
    <dialog
      ref={dialogRef}
      id={id || panelId}
      className={full ? 'status-live-dialog status-live-dialog--full' : 'status-live-dialog'}
      aria-labelledby={`${panelId}-title`}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className="status-live-panel">
        <header className="status-live-head">
          <div>
            <p className="status-live-kicker">Colyseus · live occupancy</p>
            <h2 id={`${panelId}-title`}>Realtime</h2>
            <p className="status-live-host">
              {publicUrl?.replace(/^https?:\/\//, '') || 'realtime'}
            </p>
          </div>
          <div className="status-live-actions">
            <button
              type="button"
              className="status-live-icon"
              onClick={toggleFull}
              aria-label={full ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={full ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {full ? (
                <ArrowsPointingInIcon className="h-5 w-5" aria-hidden />
              ) : (
                <ArrowsPointingOutIcon className="h-5 w-5" aria-hidden />
              )}
            </button>
            <button
              type="button"
              className="status-live-icon"
              onClick={onClose}
              aria-label="Close realtime observatory"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </header>
        <LiveProbeGraph target={target} initialLatencyMs={initialLatencyMs} />
      </div>
    </dialog>
  )
}
