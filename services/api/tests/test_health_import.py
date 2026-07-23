"""Smoke: app imports and health route shape without requiring DB."""

from fastapi.testclient import TestClient

# Avoid requiring DB on import for pure unit path
import os

os.environ.setdefault("REQUIRE_DATABASE", "0")


def test_app_imports():
    from bevel_api.main import app

    assert app.title == "BEVEL API"


def test_health_without_db():
    from bevel_api.main import app

    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["service"] == "bevel-api"
    assert "database" in data
