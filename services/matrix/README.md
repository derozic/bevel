# BEVEL Matrix homeserver (Synapse)

Ops package for **Phase 1+** production Matrix. Application Service lives in
the FastAPI control plane (`/_matrix/app/v1/*`).

## Layout

| File | Purpose |
|------|---------|
| `homeserver.yaml.example` | Synapse config template |
| `appservice-bevel.yaml.example` | AS registration (tokens match API env) |
| `../caddy/sites/matrix.conf` | Public `matrix.bevel.is` reverse proxy |

## Deploy (outline)

1. Install Synapse (venv / package) with Postgres DB `bevel_matrix`.
2. Copy examples → `/opt/bevel/services/matrix/` and fill secrets.
3. Set API env: `MATRIX_ENABLED=1`, `MATRIX_AS_TOKEN`, `MATRIX_HS_TOKEN`,
   `MATRIX_HOMESERVER_URL=http://127.0.0.1:8008`, `MATRIX_SERVER_NAME=matrix.bevel.is`.
4. `alembic upgrade head` (maps tables).
5. Caddy import `matrix.conf` and reload (never kill machine-wide Caddy).
6. `curl https://api.bevel.is/api/v1/matrix/status`

## Matrix 2.0

- Enable Sliding Sync (native Synapse or proxy URL → `MATRIX_SLIDING_SYNC_URL`).
- Element Call / MatrixRTC → `MATRIX_ELEMENT_CALL_URL` + TURN.
- Federation: open :8448 only when `matrixFederation` tenants exist; use allowlists.

## Do not

- Run on the decli GCP project; Matrix is product infra on BEVEL hosts.
- Enable open federation without enterprise plan gates.
