from __future__ import annotations

import logging
from datetime import datetime

import httpx

from api.config import settings

log = logging.getLogger(__name__)

BASE = "https://jsearch.p.rapidapi.com/search"


async def search(
    query: str,
    page: int = 1,
    num_pages: int = 1,
    remote_only: bool = False,
) -> list[dict]:
    """Return normalized JSearch job dicts."""
    if not settings.jsearch_rapidapi_key:
        log.warning("JSearch key not configured — returning empty list")
        return []

    params: dict = {
        "query": query,
        "page": str(page),
        "num_pages": str(num_pages),
    }
    if remote_only:
        params["remote_jobs_only"] = "true"

    headers = {
        "X-RapidAPI-Key": settings.jsearch_rapidapi_key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get(BASE, params=params, headers=headers)
            r.raise_for_status()
            data = r.json()
        except Exception as exc:
            log.error("JSearch fetch failed: %s", exc)
            return []

    return _normalize(data.get("data", []))


def _normalize(raw: list[dict]) -> list[dict]:
    out = []
    for r in raw:
        out.append({
            "source": "jsearch",
            "external_id": r.get("job_id", ""),
            "title": r.get("job_title", ""),
            "company": r.get("employer_name", ""),
            "location": _location(r),
            "salary_min": r.get("job_min_salary"),
            "salary_max": r.get("job_max_salary"),
            "description": r.get("job_description", ""),
            "url": r.get("job_apply_link", ""),
            "posted_at": _parse_epoch(r.get("job_posted_at_timestamp")),
        })
    return out


def _location(r: dict) -> str:
    parts = filter(None, [r.get("job_city"), r.get("job_state"), r.get("job_country")])
    loc = ", ".join(parts)
    if r.get("job_is_remote"):
        return f"{loc} (Remote)" if loc else "Remote"
    return loc


def _parse_epoch(ts: int | None) -> datetime | None:
    if ts is None:
        return None
    try:
        return datetime.utcfromtimestamp(ts)
    except (ValueError, OSError):
        return None
