# Matrix fabric for BEVEL (Matrix 2.0 path)

BEVEL keeps **Colyseus** for live agent UX and adds **Matrix** as the open
messaging substrate (federation, Element, E2EE, MatrixRTC VoIP).

Reference: [Matrix 2.0](https://matrix.org/blog/2023/09/matrix-2-0/) — Sliding
Sync, native group VoIP, simplified crypto, faster join.

## Architecture

```
BEVEL UI (/#channel) ──► Colyseus (presence / agent loops)
         │
         └── dual-write ──► Message Plane (Postgres)
                                  │
                                  ├── Matrix appservice ──► Synapse
                                  ├── Slack / iMessage / SMS bridges
                                  └── Search / agents (cleartext policy)
```

| Layer | Role |
|-------|------|
| Colyseus | Low-latency fleet channels, agent sessions |
| Postgres | Canonical BEVEL messages + Matrix id maps |
| Synapse | CS API, Sliding Sync, federation, VoIP signaling |
| Appservice | Bidirectional bridge BEVEL ↔ Matrix |

## Feature flags

| Flag | Min plan | Access | Meaning |
|------|----------|--------|---------|
| `matrix` | pro | beta | Dual-write rooms + HS connectivity |
| `matrixFederation` | team | beta | Federate with other servers |
| `matrixE2ee` | team | beta | E2EE for DMs / optional channels |
| `matrixVoip` | team | beta | MatrixRTC / Element Call |
| `matrixExternalClients` | enterprise | beta | Element etc. allowed |

YAML:

```yaml
plan: pro
feature_access: beta
features:
  matrix: true
  matrix_federation: false
  matrix_e2ee: false
  matrix_voip: false
  matrix_external_clients: false
```

## Room mapping

| BEVEL | Matrix |
|-------|--------|
| Tenant | Space `!space_…:matrix.bevel.is` |
| `#general` | Room alias `#tenant_general:matrix.bevel.is` |
| Message `msg_*` | `m.room.message` event id |
| User email / sub | `@localpart:matrix.bevel.is` (OIDC) |
| Agent `brain` | `@agent_brain:matrix.bevel.is` (appservice) |

## E2EE policy (default)

- **Org channels** (`#general`, …): **not** E2EE by default so agents, search,
  SMS, and Slack bridges can read content.
- **DMs**: E2EE when `matrixE2ee` is on.
- Agents never join pure-E2EE rooms without an explicit membership + keys path.

## Env (API + appservice)

```bash
MATRIX_ENABLED=1
MATRIX_HOMESERVER_URL=http://127.0.0.1:8008
MATRIX_SERVER_NAME=matrix.bevel.is
MATRIX_AS_TOKEN=…          # appservice token
MATRIX_HS_TOKEN=…          # homeserver → AS token
MATRIX_AS_ID=bevel
MATRIX_BOT_LOCALPART=bevel_bridge
MATRIX_SLIDING_SYNC_URL=   # optional proxy
MATRIX_ELEMENT_CALL_URL=   # optional VoIP
```

## Caddy

```
matrix.bevel.is {
  reverse_proxy 127.0.0.1:8008
}
```

Federation: well-known + :8448 per Synapse docs (`services/matrix/`).

## Phases

See [MATRIX_PR_PLAN.md](./MATRIX_PR_PLAN.md).

## Verify

```bash
# API status (local)
curl -sS https://api.bevel.lvh.me/api/v1/matrix/status | jq .

# Appservice health (HS hits this)
curl -sS -H "Authorization: Bearer $MATRIX_HS_TOKEN" \
  https://api.bevel.lvh.me/_matrix/app/v1/thirdparty/protocol/bevel
```
