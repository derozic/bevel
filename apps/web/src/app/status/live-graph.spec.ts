import { describe, expect, it } from 'vitest'
import {
  formatClock,
  formatHz,
  formatPerMinute,
  formatUptime,
  hzFor,
  perMinute,
  pickRealtimePayload,
  successPct,
  toAreaPath,
  toPolyline,
  toSmoothPath,
  toVolumeRects,
  viewStart,
  volumeMax,
  xAt,
  yMaxFor,
  type ProbeSample,
} from './live-graph'

describe('status live graph', () => {
  it('starts empty until a human click produces samples', () => {
    expect(toPolyline([], 100, 40, 100, 15_000)).toBe('')
  })

  it('maps the first click sample to the origin of the plot', () => {
    const samples: ProbeSample[] = [{ elapsedMs: 0, latencyMs: 40, ok: true }]
    expect(toPolyline(samples, 100, 40, 80, 15_000)).toBe('0.0,20.0')
  })

  it('raises the ceiling with observed latency', () => {
    expect(yMaxFor([{ elapsedMs: 0, latencyMs: 36, ok: true }])).toBe(50)
    expect(yMaxFor([{ elapsedMs: 0, latencyMs: 210, ok: true }])).toBe(290)
  })

  it('fills the canvas from the click, then slides a 60s window', () => {
    expect(viewStart(12_000, 60_000)).toBe(0)
    expect(xAt(4_500, 100, 60_000, 4_500)).toBe(100)
    expect(viewStart(90_000, 60_000)).toBe(30_000)
    expect(xAt(90_000, 100, 60_000, 90_000)).toBe(100)
  })

  it('formats watch clock and process uptime', () => {
    expect(formatClock(0)).toBe('00:00.0')
    expect(formatClock(14_200)).toBe('00:14.2')
    expect(formatClock(3_661_000)).toBe('1:01:01')
    expect(formatUptime(12)).toBe('12s')
    expect(formatUptime(3720)).toBe('1h 2m')
  })

  it('reports probe rate from samples that arrived after the click', () => {
    expect(hzFor(0, 1500)).toBe(0)
    expect(hzFor(10, 15_000)).toBeCloseTo(2 / 3, 5)
    expect(formatHz(0.666)).toBe('0.67 Hz')
  })

  it('reads occupancy and index volume from /health', () => {
    expect(
      pickRealtimePayload({
        status: 'ok',
        colyseus: true,
        uptimeSec: 88,
        searchIndex: { ready: true, documents: 30, sessions: 4 },
        rooms: { count: 2, clients: 5, byName: { fleet_channel: { rooms: 2, clients: 5 } } },
      }),
    ).toEqual({
      rooms: 2,
      clients: 5,
      documents: 30,
      sessions: 4,
      processUptimeSec: 88,
      colyseus: true,
      startedAt: undefined,
      publicAddress: null,
      mix: [{ name: 'fleet_channel', rooms: 2, clients: 5 }],
    })
    expect(
      pickRealtimePayload({
        rooms: 2,
        clients: 5,
        documents: 30,
        sessions: 4,
        processUptimeSec: 88,
        colyseus: true,
      }),
    ).toMatchObject({ rooms: 2, clients: 5, documents: 30 })
    expect(pickRealtimePayload({ error: 'nope' })).toBeNull()
  })

  it('builds a filled latency path and occupancy bars', () => {
    const samples: ProbeSample[] = [
      { elapsedMs: 0, latencyMs: 40, ok: true, clients: 1, rooms: 1 },
      { elapsedMs: 1500, latencyMs: 48, ok: true, clients: 2, rooms: 1 },
    ]
    const line = toSmoothPath([
      { x: 0, y: 20 },
      { x: 50, y: 10 },
    ])
    expect(line.startsWith('M')).toBe(true)
    expect(toAreaPath([{ x: 0, y: 20 }, { x: 50, y: 10 }], 40)).toContain('Z')
    expect(volumeMax(samples)).toBeGreaterThanOrEqual(4)
    expect(toVolumeRects(samples, 100, 20, 4, 60_000, 1500).length).toBe(2)
    expect(successPct(samples)).toBe(100)
  })

  it('reports occupancy drift per minute from the click window', () => {
    const samples: ProbeSample[] = [
      { elapsedMs: 0, latencyMs: 40, ok: true, clients: 2, documents: 30 },
      { elapsedMs: 30_000, latencyMs: 42, ok: true, clients: 8, documents: 36 },
    ]
    expect(perMinute(samples, 'clients')).toBe(12)
    expect(perMinute(samples, 'documents')).toBe(12)
    expect(formatPerMinute(12)).toBe('+12 / min')
    expect(formatPerMinute(0)).toBe('steady')
    expect(
      perMinute(
        [
          { elapsedMs: 0, latencyMs: 7, ok: true },
          { elapsedMs: 1500, latencyMs: 8, ok: true, documents: 6 },
        ],
        'documents',
      ),
    ).toBe(0)
  })
})
