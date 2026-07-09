export type AnalyticsEvent = {
  name: string
  tenantId: string
  properties?: Record<string, string | number | boolean>
}

export function capture(event: AnalyticsEvent): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug('[bevel/analytics]', event.name, event)
  }
  // Production: forward to events service / PostHog / etc.
}