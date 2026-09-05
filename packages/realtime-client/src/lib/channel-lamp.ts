export type ChannelLamp = 'live' | 'reconnecting' | 'down'

export type PresenceStatus = 'here' | 'idle' | 'reconnecting'

export function coercePresenceStatus(value: unknown): PresenceStatus {
  return value === 'idle' || value === 'reconnecting' || value === 'here'
    ? value
    : 'here'
}

export function channelLampState(opts: {
  connected: boolean
  reconnecting: boolean
}): ChannelLamp {
  if (opts.connected) return 'live'
  if (opts.reconnecting) return 'reconnecting'
  return 'down'
}

export function channelLampLabel(lamp: ChannelLamp): string {
  if (lamp === 'live') return 'Channel live'
  if (lamp === 'reconnecting') return 'Reconnecting'
  return 'Channel down'
}

export function isAbnormalClose(code?: number, reason?: string): boolean {
  if (code === 1006 || code === 4000 || code === 4001 || code === 4002) return true
  const raw = `${code ?? ''} ${reason ?? ''}`
  return /1006|abnormal close|timed out|timeout|connection lost|websocket/i.test(raw)
}

export function presenceTooltip(name: string, status?: PresenceStatus): string {
  if (!status) return name
  return `${name} · ${status}`
}
