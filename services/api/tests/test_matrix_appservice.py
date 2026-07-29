"""Appservice route smoke tests (no DB)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from bevel_api.main import app


def test_matrix_status_endpoint() -> None:
    client = TestClient(app)
    res = client.get("/api/v1/matrix/status")
    assert res.status_code == 200
    data = res.json()
    assert "enabled" in data
    assert "phases" in data
    assert data["phases"]["flags"] is True


def test_as_protocol_fails_closed_without_hs_token(monkeypatch) -> None:
    """Appservice must never accept unauthenticated traffic (fail closed)."""
    monkeypatch.delenv("MATRIX_ENABLED", raising=False)
    monkeypatch.delenv("MATRIX_HS_TOKEN", raising=False)
    monkeypatch.delenv("MATRIX_AS_TOKEN", raising=False)
    client = TestClient(app)
    res = client.get("/_matrix/app/v1/thirdparty/protocol/bevel")
    assert res.status_code == 503


def test_as_protocol_rejects_bad_token(monkeypatch) -> None:
    monkeypatch.setenv("MATRIX_ENABLED", "1")
    monkeypatch.setenv("MATRIX_HS_TOKEN", "expected-hs-token")
    client = TestClient(app)
    res = client.get(
        "/_matrix/app/v1/thirdparty/protocol/bevel",
        headers={"Authorization": "Bearer wrong"},
    )
    assert res.status_code == 401


def test_as_protocol_accepts_bearer_and_query_token(monkeypatch) -> None:
    monkeypatch.setenv("MATRIX_HS_TOKEN", "expected-hs-token")
    client = TestClient(app)
    res = client.get(
        "/_matrix/app/v1/thirdparty/protocol/bevel",
        headers={"Authorization": "Bearer expected-hs-token"},
    )
    assert res.status_code == 200
    assert res.json()["instances"][0]["network_id"] == "bevel"

    res_q = client.get(
        "/_matrix/app/v1/thirdparty/protocol/bevel",
        params={"access_token": "expected-hs-token"},
    )
    assert res_q.status_code == 200


def test_matrix_mutating_routes_require_internal_auth(monkeypatch) -> None:
    monkeypatch.setenv("MATRIX_ENABLED", "1")
    monkeypatch.setenv("MATRIX_AS_TOKEN", "as-token")
    monkeypatch.setenv("FLEET_INTERNAL_API_KEY", "fleet-secret")
    monkeypatch.setenv("BEVEL_ENV", "production")
    client = TestClient(app)
    res = client.post(
        "/api/v1/matrix/publish",
        json={
            "tenant_slug": "2x4m",
            "channel_slug": "general",
            "message": {"id": "msg_x", "body": "hi"},
        },
    )
    # 401 when auth is checked; 503 if DB is down before auth (CI without Postgres)
    assert res.status_code in (401, 503)
