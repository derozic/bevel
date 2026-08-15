"""Folksonomy slug rules — shared tags on agents, people, and tracks."""

from bevel_api.repositories.folksonomy import normalize_tag, parse_tags


def test_normalize_tag_is_folksonomic() -> None:
    assert normalize_tag("TypeScript") == "typescript"
    assert normalize_tag(" on call ") == "on-call"
    assert normalize_tag("###") == ""
    assert len(normalize_tag("a" * 80)) == 32


def test_parse_tags_dedupes() -> None:
    assert parse_tags("AI, product, ai, On-Call") == ["ai", "product", "on-call"]
    assert parse_tags(["bevel", "Bevel", "x"]) == ["bevel"]
