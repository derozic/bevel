from fastapi.testclient import TestClient

from bevel_api.lib.nuggets import (
    NUGGET_INGEST_URL,
    NUGGET_PREFIX,
    lint_nugget,
    nugget_message,
    parse_nugget_payload,
    serialize_nugget,
)
from bevel_api.main import app
from bevel_api.routers.ingest import NUGGET_INGEST_URL as ROUTER_URL


def test_nugget_ingest_url_is_stable() -> None:
    assert NUGGET_INGEST_URL == "/api/v1/ingest/nuggets"
    assert ROUTER_URL == "/api/v1/ingest/nuggets"


def test_serialize_prefix() -> None:
    raw = serialize_nugget(
        {
            "scale": "organism",
            "source": "clickup",
            "title": "Ship it",
            "atoms": [
                {"kind": "chip", "value": "in review"},
                {"kind": "person", "value": "Scott"},
            ],
        }
    )
    assert raw.startswith(NUGGET_PREFIX)
    parsed = parse_nugget_payload(raw)
    assert parsed is not None
    assert parsed["title"] == "Ship it"
    assert parsed["v"] == 1


def test_lint_rejects_fat_atom() -> None:
    issues = lint_nugget(
        {
            "scale": "atom",
            "source": "magenta",
            "title": "too much",
            "atoms": [
                {"kind": "chip", "value": "a"},
                {"kind": "chip", "value": "b"},
                {"kind": "chip", "value": "c"},
            ],
        }
    )
    assert any(row["code"] == "atom.too-big" for row in issues)


def test_lint_page_needs_sections() -> None:
    issues = lint_nugget(
        {"scale": "page", "source": "cmyk", "title": "kit", "atoms": []}
    )
    assert any(row["code"] == "page.empty" for row in issues)


def test_lint_requires_atom_kind() -> None:
    issues = lint_nugget(
        {
            "scale": "molecule",
            "source": "linear",
            "title": "moved",
            "atoms": [
                {"label": "id", "value": "BEV-184"},
                {"kind": "chip", "label": "state", "value": "In Progress"},
            ],
        }
    )
    assert any(row["code"] == "atom.kind" for row in issues)


def test_nugget_message_posts_prefixed_json_onto_a_track() -> None:
    msg = nugget_message(
        {
            "scale": "template",
            "source": "cmyk",
            "title": "BrandKit partial",
            "sections": [{"title": "Header", "body": "mark"}],
        }
    )
    assert msg["kind"] == "nugget"
    assert msg["nuggetScale"] == "template"
    assert msg["body"].startswith(NUGGET_PREFIX)
    parsed = parse_nugget_payload(msg["body"])
    assert parsed is not None
    assert parsed["v"] == 1
    assert parsed["title"] == "BrandKit partial"
    assert parsed["sections"][0]["title"] == "Header"


def test_nugget_ingest_contract_is_public() -> None:
    client = TestClient(app)
    res = client.get("/api/v1/ingest/nuggets")
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["ingest"] == "/api/v1/ingest/nuggets"
    assert data["prefix"] == "bevel-nugget:v1"
    assert "template" in data["scales"]
    assert "page" in data["scales"]
