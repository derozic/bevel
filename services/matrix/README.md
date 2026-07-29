# BEVEL Matrix homeserver (Synapse)

Ops package for **Phase 1+** production Matrix. Application Service lives in
the FastAPI control plane (`/_matrix/app/v1/*`).

## Layout

| File | Purpose |
|------|---------|
| `homeserver.yaml.example` | Synapse config template |
| `appservice-bevel.yaml.example` | AS registration (tokens match API env) |
| `../caddy/sites/matrix.conf` | Public `matrix.bevel.is` reverse proxy |

## Cost

| Mode | Extra $/mo | Notes |
|------|------------|--------|
| **Same EC2 (default)** | **~$0** | `MemoryMax=512M`, federation off |
| Dedicated t3.small | ~$12–15 | When OOM or federation |

Details: [docs/MATRIX_EC2.md](../../docs/MATRIX_EC2.md).

## Deploy (outline)

```bash
# One-shot on bevel-prod (after code is at /opt/bevel)
sudo bash /opt/bevel/scripts/install-matrix-synapse.sh
```

Manual steps the script covers:

1. Postgres DB `bevel_matrix` + Synapse venv  
2. Secrets in `/opt/bevel/services/matrix/.secrets`  
3. `homeserver.yaml` + appservice registration  
4. systemd `bevel-matrix`  
5. API `MATRIX_*` env + alembic  
6. Caddy `matrix.bevel.is` **reload**  
7. `curl https://api.bevel.is/api/v1/matrix/status`

## Matrix 2.0

- Enable Sliding Sync (native Synapse or proxy URL → `MATRIX_SLIDING_SYNC_URL`).
- Element Call / MatrixRTC → `MATRIX_ELEMENT_CALL_URL` + TURN.
- Federation: open :8448 only when `matrixFederation` tenants exist; use allowlists.

## Do not

- Run on the decli GCP project; Matrix is product infra on BEVEL hosts.
- Enable open federation without enterprise plan gates.
