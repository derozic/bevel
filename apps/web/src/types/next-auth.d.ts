import 'next-auth'

declare module 'next-auth' {
  interface Session {
    tenantId?: string
    tenantSlug?: string
    realtimeToken?: string
    apiToken?: string
    githubLogin?: string
    canPutOnWork?: boolean
  }
}