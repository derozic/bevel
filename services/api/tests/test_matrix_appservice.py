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


def test_as_protocol_without_token_when_disabled(monkeypatch) -> None:
    monkeypatch.delenv("MATRIX_ENABLED", raising=False)
    monkeypatch.delenv("MATRIX_HS_TOKEN", raising=False)
    monkeypatch.delenv("MATRIX_AS_TOKEN", raising=False)
    client = TestClient(app)
    res = client.get("/_matrix/app/v1/thirdparty/protocol/bevel")
    assert res.status_code == 200
    assert res.json()["instances"][0]["network_id"] == "bevel"


def test_as_protocol_rejects_bad_token(monkeypatch) -> None:
    monkeypatch.setenv("MATRIX_ENABLED", "1")
    monkeypatch.setenv("MATRIX_HS_TOKEN", "expected-hs-token")
    client = TestClient(app)
    res = client.get(
        "/_matrix/app/v1/thirdparty/protocol/bevel",
        headers={"Authorization": "Bearer wrong"},
    )
    assert res.status_code == 401
