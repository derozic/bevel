# BEVEL · native iMessage host (macOS)

**Optional.** Only Mac operators who want agents to prompt them on this
channel. Off unless they grant access in Native Hub.

Replaces the standalone [BlueBubbles](https://github.com/BlueBubblesApp) + Firebase
server. The Silicon Mac app reads Messages `chat.db` and sends via the public
Messages.app AppleScript dictionary. No Electron helper, no FCM, no `:1234`.

Android counterpart (own number, SMS only): [GOOGLE_MESSAGES.md](./GOOGLE_MESSAGES.md).

The Silicon app **is** the iMessage host. It speaks the BlueBubbles v1
HTTP subset on `127.0.0.1:1234` so existing Bevel / Hermes callers keep
working. **BlueBubbles.app is not required.** Enable the feature in
Native Hub → iMessage.

Workspace ingest, thread binding, and the enterprise inbox index are follow-up
PRs. This document covers the **local host** that already ships in Native Hub.

## What is live

| Surface | Status |
|---------|--------|
| Native Hub → **iMessage** card | Probe, grant access, account mode, test send |
| Read `~/Library/Messages/chat.db` | Read-only SQLite + WAL poll |
| Send | AppleScript to Messages.app |
| Apple ID mode | Dedicated (recommended) or Personal — stored on this Mac |
| BlueBubbles / Firebase | Not used |

## Permissions

The macOS runner is **unsandboxed** (Developer ID), because Full Disk Access
cannot reach `chat.db` inside the App Sandbox.

1. **Full Disk Access** — System Settings → Privacy & Security → Full Disk Access → BEVEL
2. **Automation** — allow BEVEL to control Messages
3. Sign into **Messages.app** (dedicated Apple ID recommended)

Native Hub buttons open the right privacy panes.

## Code map

```
apps/mobile/macos/Runner/
  IMessageChannel.swift   # Flutter method + event channel
  IMessageStore.swift     # chat.db (read-only)
  IMessageSender.swift    # AppleScript send
apps/mobile/lib/native/
  imessage_bridge.dart
apps/mobile/lib/ui/native_hub_page.dart
```

Channel: `com.derozic.bevel/imessage`

## What is not here yet

- Binding a thread to a Bevel channel / DM
- Outbox pull from `api.bevel.is` (API never dials this Mac)
- Enterprise FTS5 inbox + RAG recall

See the implementation plan. Until those land, `/api/imessage/send` may still
talk to a leftover BlueBubbles URL if `BLUEBUBBLES_*` is set — the Mac app
does not.

## Related

- [NATIVE_INTEGRATIONS.md](./NATIVE_INTEGRATIONS.md)
- Legacy notes: [BLUEBUBBLES_IMESSAGE.md](./BLUEBUBBLES_IMESSAGE.md) (superseded)
