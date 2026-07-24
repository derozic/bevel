"""Announcement active-window logic (no Postgres required)."""

from datetime import datetime, timedelta, timezone

from bevel_api.db.models.announcement import Announcement
from bevel_api.repositories.announcements import _is_active


def _row(**kwargs) -> Announcement:
    now = datetime.now(timezone.utc)
    defaults = dict(
        id="t1",
        title="",
        body="hi",
        icon="",
        link_label="x",
        link_href="/",
        link_kind="app",
        cta_variant="link",
        placement="top",
        kind="static",
        dismissible=True,
        enabled=True,
        priority=0,
        audience="all",
        tenant_slugs=[],
        style={},
        starts_at=None,
        ends_at=None,
        created_at=now,
        updated_at=now,
    )
    defaults.update(kwargs)
    return Announcement(**defaults)


def test_disabled_not_active():
    assert _is_active(_row(enabled=False)) is False


def test_future_start_not_active():
    future = datetime.now(timezone.utc) + timedelta(days=1)
    assert _is_active(_row(starts_at=future)) is False


def test_past_end_not_active():
    past = datetime.now(timezone.utc) - timedelta(days=1)
    assert _is_active(_row(ends_at=past)) is False


def test_open_window_active():
    assert _is_active(_row()) is True
