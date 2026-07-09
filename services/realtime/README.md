# BEVEL Realtime Service

**Transport layer 2: Live bidirectional (WebSocket)**

Use for collaboration, cursor presence, chat, shared sessions, and live control.

- Protocol: WebSocket (Colyseus)
- Not married to any single host — deploy on Vercel Functions WS beta, Cloudflare, or standalone Node
- Apps consume via `@bevel/realtime-client` only

Do **not** put SSE or WebRTC in this service. Those live elsewhere:

| Layer | Package / route |
|-------|-----------------|
| Async stream (SSE) | `@bevel/async-stream`, `apps/web/api/streams` |
| Live bidirectional | `services/realtime`, `@bevel/realtime-client` |
| Live media (WebRTC) | `@bevel/feature-webrtc` (opt-in) |