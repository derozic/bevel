"""Deprecated module path.

Runtime storage is PostgreSQL via `bevel_api.repositories.announcements`.
Canned first-boot content lives in `announcement_seed.py`.
"""

from bevel_api.lib.announcement_seed import DEFAULT_STYLE, SEED, SOFT_SKY_STYLE

__all__ = ["DEFAULT_STYLE", "SOFT_SKY_STYLE", "SEED"]
