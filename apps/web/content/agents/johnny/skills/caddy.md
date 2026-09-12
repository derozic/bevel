# Caddy Skill

Single-instance enforcement and config validation.

- Exactly one Caddy on :443
- Valid global Caddyfile imports, no duplicate hostnames
- Trusted local CA (`caddy trust`)
- Reload, never kill