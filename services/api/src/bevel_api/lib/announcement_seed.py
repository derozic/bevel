"""Canned announcement content for first boot seed only (not a runtime store)."""

from __future__ import annotations

from typing import Any

DEFAULT_STYLE: dict[str, Any] = {
    "textColor": "#1a1200",
    "linkColor": "#1a1200",
    "gradient": {
        "angleDeg": 92,
        "stops": [
            {"color": "#f6c84a", "p3": "0.97 0.78 0.2", "at": 0},
            {"color": "#efb020", "p3": "0.95 0.68 0.1", "at": 45},
            {"color": "#f0c040", "p3": "0.96 0.74 0.16", "at": 100},
        ],
    },
}

SOFT_SKY_STYLE: dict[str, Any] = {
    "textColor": "#1f2937",
    "linkColor": "#1f2937",
    "ctaBg": "#ffffff",
    "ctaText": "#1f2937",
    "ctaBorder": "rgba(15, 23, 42, 0.14)",
    "iconBg": "#dbeafe",
    "iconColor": "#2563eb",
    "gradient": {
        "angleDeg": 90,
        "stops": [
            {"color": "#e8f6ff", "p3": "0.91 0.96 1", "at": 0},
            {"color": "#dff2ff", "p3": "0.88 0.94 1", "at": 50},
            {"color": "#d4edff", "p3": "0.84 0.92 1", "at": 100},
        ],
    },
}

SEED: list[dict[str, Any]] = [
    {
        "id": "seed-flutter-mobile",
        "title": "",
        "body": "Stay connected to BEVEL, even when you're on the go",
        "icon": "device-phone-mobile",
        "linkLabel": "Get the Flutter app",
        "linkHref": "/download",
        "linkKind": "app",
        "ctaVariant": "button",
        "placement": "top",
        "kind": "static",
        "dismissible": True,
        "enabled": True,
        "priority": 20,
        "audience": "all",
        "tenantSlugs": [],
        "style": SOFT_SKY_STYLE,
        "startsAt": "",
        "endsAt": "",
    },
    {
        "id": "seed-next-step",
        "title": "Action may be required:",
        "body": (
            "Complete your profile so teammates and agents know who you are — "
            "display name, handle, short bio (280 chars), and socials."
        ),
        "icon": "user-group",
        "linkLabel": "Open profile",
        "linkHref": "/console/settings?section=profile#profile-bio",
        "linkKind": "app",
        "ctaVariant": "link",
        "placement": "bottom",
        "kind": "next_step",
        "dismissible": True,
        "enabled": True,
        "priority": 10,
        "audience": "authenticated",
        "tenantSlugs": [],
        "style": DEFAULT_STYLE,
        "startsAt": "",
        "endsAt": "",
    },
]
