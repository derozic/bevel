"""Deprecated module path.

Runtime storage is PostgreSQL via `bevel_api.repositories.push_tokens`.
"""

raise ImportError(
    "bevel_api.lib.push_tokens is removed. "
    "Use bevel_api.repositories.push_tokens (Postgres) instead."
)
