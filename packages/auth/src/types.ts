import 'next-auth'
import 'next-auth/jwt'

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
    /** True when email matches multiple orgs — show workspace picker. */
    needsWorkspacePick?: boolean
    workspaceCandidates?: string[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    tenantId?: string
    tenantSlug?: string
    tenantHost?: string
    realtimeNamespace?: string
    githubLogin?: string
    picture?: string | null
    needsWorkspacePick?: boolean
    workspaceCandidates?: string
    workspaceSwitchSlug?: string
  }
}
