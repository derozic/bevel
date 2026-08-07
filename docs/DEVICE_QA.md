# Device QA — consumer chat ship gate

Run the interactive checklist:

```bash
./scripts/mobile/device-qa.sh
./scripts/mobile/device-qa.sh run ios      # or android / macos
```

## Scope

| In scope | Out of scope (web only) |
|----------|-------------------------|
| Cold start → last channel | Console / API keys |
| Google Workspace OAuth handoff | Slack / integrations admin |
| Channel switch + timeline + Hermes talk | Workflows / status board |
| Composer + keyboard | Desktop Hermes orchestration |
| Push token + open from notification | Full offline message queue |

## Pass criteria

1. **Cold start:** signed-in user lands in chat without hunting a hub.
2. **Auth:** system Google → deep link → WebView session healthy once.
3. **Channels:** phone sheet + tablet rail both change conversation.
4. **Composer:** send message visible in thread; keyboard usable.
5. **Push:** (when Firebase configured) test send reaches device and deep-links.

## Related

- [NATIVE_PUSH.md](./NATIVE_PUSH.md)
- [NATIVE_RELEASE.md](./NATIVE_RELEASE.md)
- [STORE_SCREENSHOTS.md](./STORE_SCREENSHOTS.md)
