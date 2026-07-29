# Matrix support — PR plan

Stack order (merge bottom-up). Each PR is independently reviewable.

| PR | Title | Scope |
|----|-------|--------|
| **1** | `feat(matrix): flags, design docs, tenant schema` | FEATURE_FLAG_IDS, TenantFeatures, loader YAML, MATRIX.md |
| **2** | `feat(matrix): Postgres maps + appservice dual-write API` | Alembic 0003, models, CS client, routers, tests |
| **3** | `feat(matrix): client package + web Matrix 2.0 UI hooks` | `@bevel/matrix`, Sliding Sync types, prefs / VoIP stubs |
| **4** | `feat(matrix): bridge appservice interfaces` | Slack/iMessage/SMS → Matrix publish hooks |
| **5** | `feat(matrix): federation + agent bot identities` | Federation docs, agent MXID mint, enterprise clients |

## Definition of done (full ship)

- [x] Feature flags + docs
- [x] Room/event/user mapping tables
- [x] Appservice transaction ingress + dual-write egress (client)
- [x] Message append hooks Matrix publish (best-effort)
- [x] Client package with Sliding Sync / VoIP config surface
- [x] Bridge registry interfaces
- [x] Agent MXID convention + federation allowlist helpers
- [ ] Production Synapse process on EC2 (ops; config examples shipped)
- [ ] Live Element E2E on matrix.bevel.is (requires HS deploy + secrets)

## Non-goals in this stack

- Replacing Colyseus
- Full Element embed
- Automatic multi-region HS
