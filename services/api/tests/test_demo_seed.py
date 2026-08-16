"""Demo welcome seed is checked into the tenant folder."""

from pathlib import Path


def test_demo_has_welcome_seed() -> None:
    general = (
        Path(__file__).resolve().parents[3] / "tenants" / "demo" / "seed" / "general.jsonl"
    )
    assert general.is_file()
    text = general.read_text(encoding="utf-8")
    assert "demo.2x4m.cc" in text
    assert "laptop" in text
    assert "Hermes" in text
