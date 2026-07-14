import 'next-auth'

declare module 'next-auth' {
  interface Session {
    tenantId?: string
    tenantSlug?: string
    tenantHost?: string
    realtimeNamespace?: string
    realtimeToken?: string
    apiToken?: string
    githubLogin?: string
    canPutOnWork?: boolean
    needsWorkspacePick?: boolean
    workspaceCandidates?: string[]
  }
}