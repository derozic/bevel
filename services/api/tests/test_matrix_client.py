"""Unit tests for Matrix client helpers (no homeserver required)."""

from __future__ import annotations

from bevel_api.lib.matrix_agents import federation_allowed
from bevel_api.lib.matrix_client import (
    agent_mxid,
    channel_alias,
    matrix_enabled,
    sanitize_localpart,
    server_name,
    user_mxid,
)
from bevel_api.lib.matrix_dual_write import matrix_status_payload


def test_sanitize_localpart() -> None:
    assert sanitize_localpart("Hello World!") == "hello_world"
    assert "derozic" in sanitize_localpart("user@derozic.com")
    assert len(sanitize_localpart("a" * 100)) <= 64


def test_mxids(monkeypatch) -> None:
    monkeypatch.setenv("MATRIX_SERVER_NAME", "matrix.bevel.is")
    assert agent_mxid("2x4m", "brain").startswith("@agent_2x4m_brain:")
    assert user_mxid("scott@derozic.com").startswith("@")
    assert channel_alias("2x4m", "general") == "#2x4m_general:matrix.bevel.is"
    assert server_name() == "matrix.bevel.is"


def test_matrix_disabled_by_default(monkeypatch) -> None:
    monkeypatch.delenv("MATRIX_ENABLED", raising=False)
    monkeypatch.delenv("MATRIX_AS_TOKEN", raising=False)
    assert matrix_enabled() is False


def test_matrix_enabled_flag(monkeypatch) -> None:
    monkeypatch.setenv("MATRIX_ENABLED", "1")
    assert matrix_enabled() is True
    monkeypatch.setenv("MATRIX_ENABLED", "0")
    monkeypatch.setenv("MATRIX_AS_TOKEN", "secret")
    assert matrix_enabled() is False


def test_status_payload(monkeypatch) -> None:
    monkeypatch.delenv("MATRIX_AS_TOKEN", raising=False)
    monkeypatch.setenv("MATRIX_ENABLED", "0")
    p = matrix_status_payload()
    assert p["enabled"] is False
    assert "phases" in p
    assert p["phases"]["dualWrite"] is True
    assert p["phases"]["appservice"] is True


def test_federation_allowed_fail_closed(monkeypatch) -> None:
    monkeypatch.setenv("MATRIX_SERVER_NAME", "matrix.bevel.is")
    assert federation_allowed(matrix_federation=False, remote_server="a.example") is False
    assert (
        federation_allowed(
            matrix_federation=True,
            remote_server="matrix.bevel.is",
        )
        is True
    )
    # Empty allowlist must NOT open federation to the world
    assert (
        federation_allowed(
            matrix_federation=True,
            remote_server="evil.example",
            allowlist=None,
        )
        is False
    )
    assert (
        federation_allowed(
            matrix_federation=True,
            remote_server="partner.example",
            allowlist=["partner.example"],
        )
        is True
    )
