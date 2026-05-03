"""LinkedIn metrics + connections + network analytics — scraper-backed."""

from __future__ import annotations

from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from api.db import get_session
from api.models.linkedin import LinkedInToken
from api.models.linkedin_metrics import LinkedInConnection, LinkedInSnapshot
from api.services import linkedin_scraper

router = APIRouter()


# ── Metrics ─────────────────────────────────────────────────────────────────


@router.get("/metrics/{profile_id}")
def get_metrics(profile_id: int, session: Session = Depends(get_session)) -> dict:
    snaps = session.exec(
        select(LinkedInSnapshot)
        .where(LinkedInSnapshot.profile_id == profile_id)
        .order_by(LinkedInSnapshot.captured_at.desc())  # type: ignore[attr-defined]
        .limit(30)
    ).all()
    if not snaps:
        return {"latest": None, "history": [], "configured": linkedin_scraper.is_configured()}

    latest = snaps[0]
    return {
        "latest": {
            "follower_count": latest.follower_count,
            "connection_count": latest.connection_count,
            "profile_views_7d": latest.profile_views_7d,
            "search_appearances_7d": latest.search_appearances_7d,
            "captured_at": latest.captured_at.isoformat(),
        },
        "history": [
            {
                "follower_count": s.follower_count,
                "connection_count": s.connection_count,
                "captured_at": s.captured_at.isoformat(),
            }
            for s in reversed(snaps)
        ],
        "configured": True,
    }


@router.post("/metrics/sync/{profile_id}")
def sync_metrics(profile_id: int, session: Session = Depends(get_session)) -> dict:
    if not linkedin_scraper.is_configured():
        raise HTTPException(
            status_code=503,
            detail="LinkedIn scraper not configured (set LINKEDIN_LI_AT_COOKIE)",
        )
    token = session.exec(
        select(LinkedInToken).where(LinkedInToken.profile_id == profile_id)
    ).first()
    if not token:
        raise HTTPException(status_code=409, detail="OAuth-connect LinkedIn first")

    # Prefer vanity slug; fall back to URN id (extracted from urn:li:person:xxx)
    urn_id = token.linkedin_urn.replace("urn:li:person:", "") if token.linkedin_urn else ""
    if not token.li_vanity_name and not urn_id:
        raise HTTPException(status_code=409, detail="No LinkedIn identifier available")

    metrics = linkedin_scraper.fetch_metrics(
        public_id=token.li_vanity_name,
        urn_id=urn_id,
    )
    if all(metrics[k] == 0 for k in ("follower_count", "connection_count", "profile_views_7d")):
        raise HTTPException(
            status_code=502,
            detail=(
                "LinkedIn scraper returned no data. Cookies may be stale or "
                "rate-limited — grab a fresh li_at + JSESSIONID from your "
                "browser and update .env.local."
            ),
        )
    snap = LinkedInSnapshot(
        profile_id=profile_id,
        follower_count=metrics["follower_count"],
        connection_count=metrics["connection_count"],
        profile_views_7d=metrics["profile_views_7d"],
        search_appearances_7d=metrics["search_appearances_7d"],
        captured_at=datetime.utcnow(),
    )
    session.add(snap)
    session.commit()
    session.refresh(snap)
    return {
        "follower_count": snap.follower_count,
        "connection_count": snap.connection_count,
        "profile_views_7d": snap.profile_views_7d,
        "search_appearances_7d": snap.search_appearances_7d,
        "captured_at": snap.captured_at.isoformat(),
    }


# ── Connections ─────────────────────────────────────────────────────────────


@router.post("/connections/sync/{profile_id}")
def sync_connections(
    profile_id: int,
    limit: int = 1000,
    session: Session = Depends(get_session),
) -> dict:
    if not linkedin_scraper.is_configured():
        raise HTTPException(status_code=503, detail="LinkedIn scraper not configured")

    rows = linkedin_scraper.fetch_connections(limit=limit)
    if not rows:
        return {"synced": 0, "message": "No connections returned (rate-limited or empty)"}

    # Upsert by (profile_id, urn) — clear old rows for this profile first
    existing = session.exec(
        select(LinkedInConnection).where(LinkedInConnection.profile_id == profile_id)
    ).all()
    by_urn = {c.urn: c for c in existing if c.urn}

    now = datetime.utcnow()
    for row in rows:
        urn = row["urn"]
        if not urn:
            continue
        if urn in by_urn:
            obj = by_urn[urn]
            for k, v in row.items():
                if k != "urn":
                    setattr(obj, k, v)
            obj.last_synced_at = now
        else:
            obj = LinkedInConnection(profile_id=profile_id, last_synced_at=now, **row)
        session.add(obj)
    session.commit()
    return {"synced": len(rows)}


@router.get("/connections/{profile_id}")
def list_connections(
    profile_id: int,
    limit: int = 200,
    session: Session = Depends(get_session),
) -> list[dict]:
    rows = session.exec(
        select(LinkedInConnection)
        .where(LinkedInConnection.profile_id == profile_id)
        .order_by(LinkedInConnection.full_name)  # type: ignore[arg-type]
        .limit(limit)
    ).all()
    return [
        {
            "urn": c.urn,
            "public_id": c.public_id,
            "full_name": c.full_name,
            "headline": c.headline,
            "current_company": c.current_company,
            "current_title": c.current_title,
            "location": c.location,
            "industry": c.industry,
            "picture_url": c.picture_url,
        }
        for c in rows
    ]


# ── Network breakdown ───────────────────────────────────────────────────────


@router.get("/network/{profile_id}/breakdown")
def network_breakdown(profile_id: int, session: Session = Depends(get_session)) -> dict:
    rows = session.exec(
        select(LinkedInConnection).where(LinkedInConnection.profile_id == profile_id)
    ).all()

    companies = Counter(c.current_company for c in rows if c.current_company)
    locations = Counter(c.location for c in rows if c.location)
    industries = Counter(c.industry for c in rows if c.industry)
    titles = Counter(_normalize_title(c.current_title) for c in rows if c.current_title)

    return {
        "total": len(rows),
        "top_companies": companies.most_common(15),
        "top_locations": locations.most_common(15),
        "top_industries": industries.most_common(15),
        "top_titles": titles.most_common(15),
    }


def _normalize_title(t: str) -> str:
    """Light normalization for grouping titles. Strips seniority words."""
    if not t:
        return ""
    s = t.lower().strip()
    for prefix in ("senior ", "sr. ", "sr ", "lead ", "principal ", "staff ", "chief "):
        if s.startswith(prefix):
            s = s[len(prefix):]
    return s.title()
