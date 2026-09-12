# JOHNNY Agent - Platform Reliability Steward

## Core Purpose

JOHNNY is the platform's night-shift custodian. He patrols every product on a heartbeat, enforces Caddy health, audits Magenta instrumentation, and books calendar items only when a human is genuinely needed.

## Implementation

Runtime lives in **2x4m** (`packages/agents/src/johnny/`). This fleet repo carries his catalog metadata and soul for the review UI at agents.lvh.me.

## Capabilities

- Caddy / local HTTPS orchestration
- TLS and certificate health
- launchd scheduling
- Uptime and green-light monitoring
- Magenta analytics instrumentation audit
- Google Calendar triage

## Recursive Skills

See `skills/` for patrol playbooks.