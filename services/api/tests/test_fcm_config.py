"""FCM helpers degrade cleanly when no service account is configured."""

from __future__ import annotations

import pytest

from bevel_api.lib import fcm as fcm_lib


@pytest.mark.asyncio
async def test_fcm_not_configured_skips_send(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FIREBASE_SERVICE_ACCOUNT_JSON", raising=False)
    monkeypatch.delenv("FIREBASE_SERVICE_ACCOUNT_PATH", raising=False)
    assert fcm_lib.fcm_configured() is False
    result = await fcm_lib.send_to_token(
        token="fake-token-for-test",
        title="t",
        body="b",
    )
    assert result.get("skipped") is True
    assert result.get("ok") is False
