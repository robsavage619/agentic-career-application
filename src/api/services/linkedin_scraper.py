"""Unofficial LinkedIn scraper for metrics + connections.

Uses tomquirk/linkedin-api which hits LinkedIn's internal Voyager endpoints.
Authenticates via email/password OR a li_at session cookie (preferred — sidesteps MFA).

Required env vars (one of):
  LINKEDIN_EMAIL + LINKEDIN_PASSWORD
  LINKEDIN_LI_AT_COOKIE
"""

from __future__ import annotations

import logging
from typing import Any

from api.config import settings

log = logging.getLogger(__name__)

_client: Any | None = None


def _get_client() -> Any:
    """Lazily build a Linkedin client. Cached as module-level singleton."""
    global _client
    if _client is not None:
        return _client

    from linkedin_api import Linkedin

    if settings.linkedin_li_at_cookie:
        _client = Linkedin("", "", cookies={"li_at": settings.linkedin_li_at_cookie})
    elif settings.linkedin_email and settings.linkedin_password:
        _client = Linkedin(settings.linkedin_email, settings.linkedin_password)
    else:
        raise RuntimeError(
            "LinkedIn scraper not configured. Set LINKEDIN_LI_AT_COOKIE or "
            "LINKEDIN_EMAIL + LINKEDIN_PASSWORD in .env.local"
        )
    return _client


def is_configured() -> bool:
    return bool(
        settings.linkedin_li_at_cookie
        or (settings.linkedin_email and settings.linkedin_password)
    )


# ── Metrics ─────────────────────────────────────────────────────────────────


def fetch_metrics(public_id: str) -> dict:
    """Pull follower count, connection count, profile views.

    Returns: {follower_count, connection_count, profile_views_7d, search_appearances_7d}
    """
    client = _get_client()

    follower_count = 0
    connection_count = 0
    try:
        followers = client.get_profile_network_info(public_id)
        follower_count = followers.get("followersCount", 0)
        connection_count = followers.get("connectionsCount", 0)
    except Exception as e:
        log.warning("LinkedIn network info failed: %s", e)

    profile_views_7d = 0
    search_appearances_7d = 0
    try:
        profile = client.get_profile(public_id)
        profile_views_7d = profile.get("profileViewsLast7Days", 0)
        search_appearances_7d = profile.get("searchAppearancesLast7Days", 0)
    except Exception as e:
        log.warning("LinkedIn profile metrics failed: %s", e)

    return {
        "follower_count": follower_count,
        "connection_count": connection_count,
        "profile_views_7d": profile_views_7d,
        "search_appearances_7d": search_appearances_7d,
    }


# ── Connections ─────────────────────────────────────────────────────────────


def fetch_connections(limit: int = 1000) -> list[dict]:
    """Pull connections list. LinkedIn paginates 100 at a time, slow at scale.

    Returns: list of normalized dicts ready to upsert into LinkedInConnection.
    """
    client = _get_client()
    raw: list[dict] = []
    try:
        # linkedin-api's get_profile_connections takes a urn_id; use search instead
        results = client.search_people(
            network_depths=["F"],  # 1st-degree only
            limit=limit,
        )
        raw = list(results) if results else []
    except Exception as e:
        log.warning("LinkedIn connections fetch failed: %s", e)
        return []

    out: list[dict] = []
    for c in raw:
        out.append(
            {
                "urn": c.get("urn_id", "") or c.get("public_id", ""),
                "public_id": c.get("public_id", ""),
                "full_name": c.get("name", "")
                or f"{c.get('first_name', '')} {c.get('last_name', '')}".strip(),
                "headline": c.get("jobtitle", "") or c.get("headline", ""),
                "current_company": c.get("location", "")
                if "company" not in c
                else c.get("company", ""),
                "current_title": c.get("jobtitle", ""),
                "location": c.get("location", ""),
                "industry": c.get("industry", ""),
                "picture_url": c.get("profile_picture", ""),
            }
        )
    return out
