"""Workflow webhook signing + room matching."""

from bevel_api.db.models.webhook import Webhook
from bevel_api.repositories.webhooks import (
    SIGNATURE_MAX_AGE_SECONDS,
    hook_wants_event,
    is_safe_outbound_url,
    matches_room,
    resolve_inbound_slug,
    sign_body,
    verify_request,
)


def _hook(**kwargs) -> Webhook:
    row = Webhook(
        id="wh_test",
        tenant_id="t1",
        name="test",
        direction="outbound",
        secret="s",
        target_kind="any",
        target_id="",
        url="https://hooks.example/bevel",
        events=["message.created"],
        enabled=True,
    )
    for key, val in kwargs.items():
        setattr(row, key, val)
    return row


def test_sign_and_verify_roundtrip() -> None:
    import time

    raw = '{"ok":true}'
    header = sign_body("sekrit", raw, int(time.time()))
    assert verify_request("sekrit", raw, signature=header, bearer=None)
    assert not verify_request("nope", raw, signature=header, bearer=None)
    assert verify_request("sekrit", raw, signature=None, bearer="sekrit")


def test_rejects_stale_timestamped_signature() -> None:
    raw = '{"ok":true}'
    stale = 1_700_000_000
    header = sign_body("sekrit", raw, stale)
    assert abs(int(__import__("time").time()) - stale) > SIGNATURE_MAX_AGE_SECONDS
    assert not verify_request("sekrit", raw, signature=header, bearer=None)


def test_sha256_body_signature() -> None:
    import hashlib
    import hmac

    raw = "hello"
    digest = hmac.new(b"sekrit", raw.encode(), hashlib.sha256).hexdigest()
    assert verify_request("sekrit", raw, signature=f"sha256={digest}", bearer=None)


def test_matches_track_vs_conversation() -> None:
    track = _hook(target_kind="track", target_id="ops")
    assert matches_room(track, "ops")
    assert not matches_room(track, "dm-usr-hermes")
    assert not matches_room(track, "product")

    dm = _hook(target_kind="conversation", target_id="dm-usr-hermes")
    assert matches_room(dm, "dm-usr-hermes")
    assert not matches_room(dm, "ops")

    any_hook = _hook(target_kind="any")
    assert matches_room(any_hook, "ops")
    assert matches_room(any_hook, "dm-usr-hermes")


def test_resolve_inbound_slug() -> None:
    hook = _hook(target_kind="track", target_id="ops")
    assert resolve_inbound_slug(hook, {}) == "ops"
    any_hook = _hook(target_kind="any")
    assert resolve_inbound_slug(any_hook, {"track": "~product"}) == "product"
    assert resolve_inbound_slug(any_hook, {"conversation": "dm-usr-portia"}) == (
        "dm-usr-portia"
    )


def test_ingest_url_is_stable() -> None:
    from bevel_api.routers.ingest import INGEST_URL

    assert INGEST_URL == "/api/v1/ingest/notifications"


def test_catalog_uses_bevel_labels() -> None:
    from bevel_api.repositories.webhooks import EVENT_CATALOG

    by_id = {row["id"]: row for row in EVENT_CATALOG}
    assert by_id["message.created"]["label"] == "New messages"
    assert by_id["track.created"]["label"] == "Track created"
    assert by_id["conversation.started"]["label"] == "Conversation started"
    assert "Group" not in by_id["track.created"]["label"]


def test_event_families_include_ftue() -> None:
    hook = _hook(events=["ftue.*"])
    assert hook_wants_event(hook, "ftue.started")
    assert hook_wants_event(hook, "ftue.first_message")
    assert not hook_wants_event(hook, "message.created")
    assert hook_wants_event(_hook(events=[]), "user.created")


def test_blocks_ssrf_hosts(monkeypatch) -> None:
    monkeypatch.setenv("BEVEL_ALLOW_LOOPBACK_WEBHOOKS", "0")
    assert is_safe_outbound_url("https://hooks.n8n.io/bevel")
    assert not is_safe_outbound_url("https://169.254.169.254/latest")
    assert not is_safe_outbound_url("file:///etc/passwd")
    assert not is_safe_outbound_url("http://127.0.0.1/secret")
    assert not is_safe_outbound_url("http://localhost:3000/hook")


def test_loopback_allowed_when_opted_in(monkeypatch) -> None:
    monkeypatch.setenv("BEVEL_ALLOW_LOOPBACK_WEBHOOKS", "1")
    assert is_safe_outbound_url("http://127.0.0.1:5678/webhook")
    assert is_safe_outbound_url("http://localhost/hook")
