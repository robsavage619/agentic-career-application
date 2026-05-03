from __future__ import annotations

import logging
from datetime import datetime

import httpx

from api.config import settings

log = logging.getLogger(__name__)

BASE = "https://api.adzuna.com/v1/api/jobs"


async def search(
    keywords: str,
    location: str = "",
    country: str = "us",
    results_per_page: int = 20,
    page: int = 1,
    salary_min: int | None = None,
) -> list[dict]:
    """Return raw Adzuna job dicts."""
    if not settings.adzuna_app_id or not settings.adzuna_app_key:
        log.warning("Adzuna credentials not configured — returning empty list")
        return []

    params: dict = {
        "app_id": settings.adzuna_app_id,
        "app_key": settings.adzuna_app_key,
        "results_per_page": results_per_page,
        "page": page,
        "content-type": "application/json",
    }
    if keywords:
        params["what"] = keywords
    if location:
        params["where"] = location
    if salary_min:
        params["salary_min"] = salary_min

    url = f"{BASE}/{country}/search/{page}"
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
        except Exception as exc:
            log.error("Adzuna fetch failed: %s", exc)
            return []

    return _normalize(data.get("results", []))


def _normalize(raw: list[dict]) -> list[dict]:
    out = []
    for r in raw:
        out.append({
            "source": "adzuna",
            "external_id": str(r.get("id", "")),
            "title": r.get("title", ""),
            "company": r.get("company", {}).get("display_name", ""),
            "location": r.get("location", {}).get("display_name", ""),
            "salary_min": r.get("salary_min"),
            "salary_max": r.get("salary_max"),
            "description": r.get("description", ""),
            "url": r.get("redirect_url", ""),
            "posted_at": _parse_dt(r.get("created")),
        })
    return out


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
