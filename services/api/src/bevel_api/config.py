"""Runtime config for the BEVEL control plane."""

from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_repo_root() -> Path:
    # services/api/src/bevel_api/config.py → repo root
    return Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    api_port: int = 43203
    web_port: int = 43200
    admin_port: int = 43201
    realtime_port: int = 43208
    domains_port: int = 43209

    bevel_repo_root: Path = _default_repo_root()
    bevel_tenants_root: Path | None = None
    realtime_server_url: str = "http://127.0.0.1:43208"
    public_api_url: str = "https://api.bevel.lvh.me"
    public_web_url: str = "https://bevel.lvh.me"
    public_realtime_url: str = "https://realtime.bevel.lvh.me"

    def tenants_root(self) -> Path:
        if self.bevel_tenants_root:
            return Path(self.bevel_tenants_root)
        env = os.getenv("BEVEL_TENANTS_ROOT")
        if env:
            return Path(env)
        return self.bevel_repo_root / "tenants"


settings = Settings()
