export type ProbeSample = {
  /** Milliseconds since the human click that started the graph. */
  elapsedMs: number
  latencyMs: number
  ok: boolean
  rooms?: number
  clients?: number
  documents?: number
  processUptimeSec?: number
}

export type RoomMix = {
  name: string
  rooms: number
  clients: number
}

export type RealtimePayload = {
  rooms: number
  clients: number
  documents: number
  sessions: number
  processUptimeSec: number
  colyseus: boolean
  startedAt?: string
  publicAddress?: string | null
  mix: RoomMix[]
}

export type ChartPoint = { x: number; y: number }

export type VolumeRect = {
  x: number
  y: number
  w: number
  h: number
  ok: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

function asFinite(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function pickRealtimePayload(raw: unknown): RealtimePayload | null {
  const root = asRecord(raw)
  if (!root) return null
  const roomsNode = asRecord(root.rooms)
  const indexNode = asRecord(root.searchIndex)
  const rooms = roomsNode
    ? (asFinite(roomsNode.count) ?? 0)
    : (asFinite(root.rooms) ?? 0)
  const clients = roomsNode
    ? (asFinite(roomsNode.clients) ?? 0)
    : (asFinite(root.clients) ?? 0)
  const documents = indexNode
    ? (asFinite(indexNode.documents) ?? 0)
    : (asFinite(root.documents) ?? 0)
  const sessions = indexNode
    ? (asFinite(indexNode.sessions) ?? 0)
    : (asFinite(root.sessions) ?? 0)
  const processUptimeSec =
    asFinite(root.uptimeSec) ?? asFinite(root.processUptimeSec) ?? 0
  const mix = pickRoomMix(roomsNode)
  const startedAt =
    typeof root.startedAt === 'string' ? root.startedAt : undefined
  const publicAddress =
    typeof root.publicAddress === 'string' ? root.publicAddress : null
  const hasShape =
    roomsNode !== null ||
    indexNode !== null ||
    asFinite(root.rooms) !== null ||
    asFinite(root.clients) !== null ||
    asFinite(root.uptimeSec) !== null ||
    asFinite(root.processUptimeSec) !== null ||
    root.colyseus === true
  if (!hasShape) return null
  return {
    rooms,
    clients,
    documents,
    sessions,
    processUptimeSec,
    colyseus: root.colyseus === true,
    startedAt,
    publicAddress,
    mix,
  }
}

function pickRoomMix(roomsNode: Record<string, unknown> | null): RoomMix[] {
  const byName = asRecord(roomsNode?.byName)
  if (!byName) return []
  const mix: RoomMix[] = []
  for (const [name, raw] of Object.entries(byName)) {
    const node = asRecord(raw)
    mix.push({
      name,
      rooms: asFinite(node?.rooms) ?? 0,
      clients: asFinite(node?.clients) ?? 0,
    })
  }
  return mix.sort(
    (a, b) => b.clients - a.clients || b.rooms - a.rooms || a.name.localeCompare(b.name),
  )
}

/** Signed rate between first and last sample, per minute. */
export function perMinute(
  samples: ProbeSample[],
  key: 'clients' | 'rooms' | 'documents',
): number {
  const series = samples.filter((s) => typeof s[key] === 'number')
  if (series.length < 2) return 0
  const first = series[0]
  const last = series[series.length - 1]
  const dtMin = (last.elapsedMs - first.elapsedMs) / 60_000
  if (dtMin <= 0) return 0
  return ((last[key] ?? 0) - (first[key] ?? 0)) / dtMin
}

export function formatPerMinute(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) < 0.05) return 'steady'
  const sign = n > 0 ? '+' : ''
  const abs = Math.abs(n)
  const body = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1)
  return `${sign}${body} / min`
}

export function yMaxFor(samples: ProbeSample[], floor = 20): number {
  const peak = samples.reduce((m, s) => Math.max(m, s.latencyMs), 0)
  const nice = Math.ceil((Math.max(peak, 1) * 1.35) / 10) * 10
  return Math.max(floor, nice)
}

export function volumeMax(samples: ProbeSample[], floor = 4): number {
  const peak = samples.reduce(
    (m, s) => Math.max(m, s.documents ?? 0, s.clients ?? 0, s.rooms ?? 0),
    0,
  )
  return Math.max(floor, Math.ceil(peak / 2) * 2)
}

export function viewWindow(
  nowElapsedMs: number,
  windowMs: number,
): { start: number; span: number } {
  const now = Math.max(0, nowElapsedMs)
  if (now <= windowMs) {
    return { start: 0, span: Math.max(now, 1) }
  }
  return { start: now - windowMs, span: windowMs }
}

export function viewStart(nowElapsedMs: number, windowMs: number): number {
  return viewWindow(nowElapsedMs, windowMs).start
}

export function xAt(
  elapsedMs: number,
  width: number,
  windowMs: number,
  nowElapsedMs = 0,
): number {
  const { start, span } = viewWindow(nowElapsedMs, windowMs)
  return ((elapsedMs - start) / span) * width
}

export function toPolyline(
  samples: ProbeSample[],
  width: number,
  height: number,
  maxY: number,
  windowMs: number,
  nowElapsedMs?: number,
): string {
  if (samples.length === 0 || width <= 0 || height <= 0 || maxY <= 0) return ''
  const now = nowElapsedMs ?? samples[samples.length - 1]?.elapsedMs ?? 0
  return samples
    .map((s) => {
      const x = xAt(s.elapsedMs, width, windowMs, now)
      const y = height - (s.latencyMs / maxY) * height
      return `${x.toFixed(1)},${Math.max(0, Math.min(height, y)).toFixed(1)}`
    })
    .join(' ')
}

export function latencyPoints(
  samples: ProbeSample[],
  width: number,
  height: number,
  maxY: number,
  windowMs: number,
  nowElapsedMs?: number,
): ChartPoint[] {
  if (samples.length === 0 || width <= 0 || height <= 0 || maxY <= 0) return []
  const now = nowElapsedMs ?? samples[samples.length - 1]?.elapsedMs ?? 0
  return samples.map((s) => ({
    x: xAt(s.elapsedMs, width, windowMs, now),
    y: Math.max(0, Math.min(height, height - (s.latencyMs / maxY) * height)),
  }))
}

/** Smooth cubic between samples — D3-like without the library. */
export function toSmoothPath(points: ChartPoint[]): string {
  if (points.length === 0) return ''
  const first = points[0]
  if (points.length === 1) return `M${first.x.toFixed(1)} ${first.y.toFixed(1)}`
  let d = `M${first.x.toFixed(1)} ${first.y.toFixed(1)}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const mx = (prev.x + curr.x) / 2
    d += ` C${mx.toFixed(1)} ${prev.y.toFixed(1)} ${mx.toFixed(1)} ${curr.y.toFixed(1)} ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`
  }
  return d
}

export function toAreaPath(points: ChartPoint[], baseline: number): string {
  const line = toSmoothPath(points)
  if (!line || points.length === 0) return ''
  const last = points[points.length - 1]
  const first = points[0]
  return `${line} L${last.x.toFixed(1)} ${baseline.toFixed(1)} L${first.x.toFixed(1)} ${baseline.toFixed(1)} Z`
}

export function toVolumeRects(
  samples: ProbeSample[],
  width: number,
  height: number,
  maxV: number,
  windowMs: number,
  tickMs: number,
  nowElapsedMs?: number,
): VolumeRect[] {
  if (samples.length === 0 || width <= 0 || height <= 0 || maxV <= 0) return []
  const now = nowElapsedMs ?? samples[samples.length - 1]?.elapsedMs ?? 0
  const { span } = viewWindow(now, windowMs)
  const barW = Math.max(2, (tickMs / Math.max(span, 1)) * width * 0.72)
  return samples.map((s) => {
    const value = Math.max(s.documents ?? 0, s.clients ?? 0, s.rooms ?? 0)
    const h = (value / maxV) * height
    const x = xAt(s.elapsedMs, width, windowMs, now) - barW / 2
    return {
      x: Math.max(0, x),
      y: height - h,
      w: barW,
      h,
      ok: s.ok,
    }
  })
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  )
  return sorted[idx]
}

export function successPct(samples: ProbeSample[]): number {
  if (samples.length === 0) return 0
  const ok = samples.filter((s) => s.ok).length
  return (ok / samples.length) * 100
}

export function hzFor(sampleCount: number, elapsedMs: number): number {
  if (sampleCount <= 0 || elapsedMs <= 0) return 0
  return sampleCount / (elapsedMs / 1000)
}

/** mm:ss.d below an hour, h:mm:ss at and above. */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms))
  const hours = Math.floor(clamped / 3_600_000)
  const minutes = Math.floor((clamped % 3_600_000) / 60_000)
  if (hours > 0) {
    const seconds = Math.floor((clamped % 60_000) / 1000)
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  const whole = Math.floor((clamped % 60_000) / 1000)
  const tenths = Math.floor((clamped % 1000) / 100)
  return `${String(minutes).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${tenths}`
}

export function formatUptime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${s % 60}s`
  return `${s}s`
}

export function formatHz(hz: number): string {
  if (hz <= 0) return '—'
  return `${hz.toFixed(hz >= 10 ? 1 : 2)} Hz`
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('en-US')
}
