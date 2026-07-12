# GitHub + BEVEL work mode

Buttery DX for humans and agents: link GitHub once, put agents on work against
configured repos, and keep every key move accountable in **`^product`**.

## Link GitHub (operators)

1. Sign in to BEVEL (Google Workspace for org tenants).
2. Open **Preferences → Integrations → Link GitHub**  
   (or the orange **Link GitHub** chip in work mode).
3. Approve scopes: `read:user`, `user:email`, `repo`  
   (`AUTH_GITHUB_SCOPES` overrides).
4. You land on **`^product`** (`/bevel/product`) when linking from Integrations.

After linking:

- `session.githubLogin` and `session.canPutOnWork` are set
- Realtime JWT carries `repoWrite` so agents can run **work mode**
- `GET /api/github/work-repos` lists tenant `work_repos` with write flags

### OAuth app setup

| Env | Purpose |
|-----|---------|
| `AUTH_GITHUB_ID` | OAuth App client id |
| `AUTH_GITHUB_SECRET` | OAuth App secret |
| `AUTH_GITHUB_SCOPES` | Optional; default `read:user user:email repo` |
| `GITHUB_WEBHOOK_SECRET` | HMAC for issue/PR webhooks |
| `BEVEL_WORK_REPO` / `BEVEL_WORK_REPOS` | Default work targets (e.g. `derozic/2x4m`) |
| `FLEET_INTERNAL_API_KEY` | Shared secret for agent/CI → BEVEL posts |

**Callback URL (local):**  
`https://bevel.2x4m.lvh.me/api/auth/callback/github`  
(and platform host if used).

## ^product channel

| Event | Source |
|-------|--------|
| Issues opened / closed / reopened | GitHub webhook |
| PRs opened / merged | GitHub webhook |
| Releases published | GitHub webhook |
| CI workflow completed | GitHub webhook or Actions |
| Agent work-mode completions | Realtime → `/api/github/agent-activity` |
| JOHNNY / program runs | `/api/agent-programs/events` (mirrored) |
| Issues created from BEVEL | `POST /api/github/tickets` |

Messages include **links back to GitHub** (issue, PR, Actions run, release).

Open: `https://bevel.2x4m.lvh.me/bevel/product`

## API surface

| Route | Role |
|-------|------|
| `GET /api/github/work-access` | Link status for FleetChat banner |
| `GET /api/github/work-repos` | Repos + `canWrite` |
| `POST /api/github/tickets` | Open issue + log to ^product |
| `POST /api/github/webhook` | GitHub → ^product |
| `POST /api/github/agent-activity` | Agent / CI accountability log |
| `POST /api/agent-programs/events` | Programs (JOHNNY) + product mirror |

## GitHub Actions → BEVEL

Use `.github/workflows/bevel-product.yml` (or call from any workflow):

```bash
curl -sS -X POST "$BEVEL_PRODUCT_URL/api/github/agent-activity" \
  -H "Content-Type: application/json" \
  -H "X-Fleet-Internal-Key: $FLEET_INTERNAL_API_KEY" \
  -d '{
    "kind": "ci_run",
    "agentId": "forge",
    "title": "CI passed on main",
    "repo": "derozic/2x4m",
    "url": "'"$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"'"
  }'
```

Webhook (preferred for issues): point the repo at  
`https://bevel.2x4m.lvh.me/api/github/webhook`  
events: `issues`, `pull_request`, `release`, `workflow_run`.

## Agent accountability & etiquette

1. **Every agent work move is logged** to `^product` with agent id + repo.
2. Prefer **issues before drive-by PRs**; link the issue in the PR body.
3. Use labels: `agent:<id>`, `bevel`, `work-mode` where useful.
4. Releases: tag semver, write release notes humans can scan; BEVEL posts them.
5. READMEs: keep install/run paths honest; agents must not invent commands.
6. Never force-push shared main; never skip CI without a documented reason in ^product.
7. Compliance: treat ^product as the audit trail — who (agent/human), what, link.

## Repo etiquette checklist (agents)

- [ ] Branch from main, named `agent/<id>/<short-topic>`
- [ ] One concern per PR; link issue
- [ ] Tests or explicit reason when not
- [ ] No secrets in commits
- [ ] Status comment in channel + ^product when blocked

## Beautiful releases

```bash
gh release create v1.2.0 --generate-notes --title "v1.2.0 — clear human title"
```

BEVEL webhook posts the release into ^product with the GitHub URL.

## Troubleshooting “Link GitHub”

| Symptom | Fix |
|---------|-----|
| Button does nothing | Confirm `AUTH_GITHUB_ID` / `SECRET`; provider always registered when set |
| Linked but work mode off | Re-link to refresh `repo` scope; check `work_mode` + `work_repos` in bevel.yaml |
| 401 on tickets | Token not in JWT — Re-link scopes |
| Webhook ignored | Set `GITHUB_WEBHOOK_SECRET`; verify `X-Hub-Signature-256` |
| Empty ^product | Ensure API (`:43203`) + realtime (`:43208`) + web are up |
