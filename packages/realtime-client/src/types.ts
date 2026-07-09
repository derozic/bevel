export type FleetAgent = {
  id: string
  name: string
  accent?: string
  category?: string
  avatar?: string
  /** 1–5 word placement line shown in hover card */
  tagline?: string
  /** One-sentence summary for hover */
  summary?: string
  /** Top capabilities surfaced on hover */
  capabilities?: string[]
}