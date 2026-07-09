export type BevelSdkConfig = {
  tenantSlug: string
  host?: string
  realtimeUrl?: string
}

/** Placeholder — external embed SDK ships in a later milestone. */
export function createBevelClient(config: BevelSdkConfig) {
  return {
    config,
    connect: async () => {
      throw new Error('SDK connect not implemented yet')
    },
  }
}