"""Daily Briefing endpoint: bucket boundaries and aggregation."""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from api.db import engine, init_db
from api.main import app
from api.models.job import Job, SavedJob
from api.models.pipeline import PipelineCard, PipelineStage
from api.models.profile import Profile


@pytest.fixture(autouse=True)
def _reset_db() -> None:
    from sqlmodel import SQLModel
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    init_db()


@pytest.fixture
def profile_id() -> int:
    with Session(engine) as session:
        p = Profile(name="Rob", rag_tag="rob")
        session.add(p)
        session.commit()
        session.refresh(p)
        assert p.id is not None
        return p.id


def _make_job(session: Session, title: str = "Senior Engineer") -> Job:
    j = Job(source="adzuna", external_id=f"ext-{title}", title=title, company="Acme")
    session.add(j)
    session.commit()
    session.refresh(j)
    return j


def _save(session: Session, profile_id: int, job: Job, *, hours_ago: float, score: float | None = 0.8, dismissed: bool = False) -> SavedJob:
    saved = SavedJob(profile_id=profile_id, job_id=job.id or 0, score=score, dismissed=dismissed)
    saved.saved_at = datetime.utcnow() - timedelta(hours=hours_ago)
    session.add(saved)
    session.commit()
    session.refresh(saved)
    return saved


def _card(
    session: Session,
    profile_id: int,
    *,
    stage: PipelineStage = PipelineStage.APPLIED,
    deadline_hours: float | None = None,
    updated_days_ago: float = 0,
) -> PipelineCard:
    c = PipelineCard(
        profile_id=profile_id,
        title="Role",
        company="Co",
        stage=stage,
        deadline=(datetime.utcnow() + timedelta(hours=deadline_hours)) if deadline_hours is not None else None,
    )
    c.updated_at = datetime.utcnow() - timedelta(days=updated_days_ago)
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


def test_briefing_empty_for_new_profile(profile_id: int) -> None:
    with TestClient(app) as client:
        r = client.get(f"/api/dashboard/briefing?profile_id={profile_id}")
    assert r.status_code == 200, r.text
    body = r.json()
    counts = body["counts"]
    assert counts == {
        "new_jobs": 0,
        "deadlines_today": 0,
        "stalled_cards": 0,
        "follow_ups": 0,
        "pipeline_open": 0,
    }


def test_briefing_404_on_unknown_profile() -> None:
    with TestClient(app) as client:
        r = client.get("/api/dashboard/briefing?profile_id=99999")
    assert r.status_code == 404


def test_briefing_buckets_each_signal(profile_id: int) -> None:
    with Session(engine) as s:
        # New job in window (saved 2h ago)
        new_job = _make_job(s, "New role")
        _save(s, profile_id, new_job, hours_ago=2, score=0.9)

        # Job saved 5 days ago — should NOT count as "new"
        old_job = _make_job(s, "Old role")
        _save(s, profile_id, old_job, hours_ago=5 * 24)

        # Dismissed should never appear
        dismissed_job = _make_job(s, "Dismissed")
        _save(s, profile_id, dismissed_job, hours_ago=1, dismissed=True)

        # Card with deadline in 6h
        _card(s, profile_id, stage=PipelineStage.INTERVIEW, deadline_hours=6, updated_days_ago=1)

        # Stalled APPLIED card (8 days ago)
        _card(s, profile_id, stage=PipelineStage.APPLIED, updated_days_ago=8)

        # Follow-up worthy: SCREENER updated 5 days ago (rule = 4)
        _card(s, profile_id, stage=PipelineStage.SCREENER, updated_days_ago=5)

        # Closed card — should NOT appear in stalled or follow-ups even if old
        _card(s, profile_id, stage=PipelineStage.CLOSED, updated_days_ago=30)

    with TestClient(app) as client:
        r = client.get(f"/api/dashboard/briefing?profile_id={profile_id}")
    assert r.status_code == 200
    body = r.json()

    assert body["counts"]["new_jobs"] == 1
    assert body["new_jobs"][0]["title"] == "New role"

    assert body["counts"]["deadlines_today"] == 1
    assert body["deadlines_today"][0]["stage"] == "INTERVIEW"

    assert body["counts"]["stalled_cards"] >= 1
    stalled_stages = {c["stage"] for c in body["stalled_cards"]}
    assert "APPLIED" in stalled_stages
    assert "CLOSED" not in stalled_stages

    follow_up_stages = {f["stage"] for f in body["follow_ups"]}
    assert "SCREENER" in follow_up_stages
    assert all(f["suggested_action"] for f in body["follow_ups"])

    # Open count: APPLIED + INTERVIEW + SCREENER + APPLIED stalled = 4 (CLOSED excluded)
    assert body["counts"]["pipeline_open"] == 3
