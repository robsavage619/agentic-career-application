"""Application decision log: dismiss with reason + history endpoint."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from api.db import engine, init_db
from api.main import app
from api.models.job import Job, SavedJob
from api.models.profile import Profile


@pytest.fixture(autouse=True)
def _reset_db() -> None:
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    init_db()


@pytest.fixture
def seeded() -> tuple[int, int]:
    with Session(engine) as session:
        p = Profile(name="Rob", rag_tag="rob")
        session.add(p)
        j = Job(source="adzuna", external_id="x1", title="Backend Engineer", company="Acme")
        session.add(j)
        session.commit()
        session.refresh(p)
        session.refresh(j)
        sj = SavedJob(profile_id=p.id or 0, job_id=j.id or 0, score=0.7)
        session.add(sj)
        session.commit()
        session.refresh(sj)
        assert p.id and sj.id
        return p.id, sj.id


def test_dismiss_with_reason_persists(seeded: tuple[int, int]) -> None:
    profile_id, saved_job_id = seeded
    with TestClient(app) as client:
        r = client.patch(
            f"/api/jobs/{saved_job_id}/dismiss",
            json={"reason": "below comp floor; remote-only role"},
        )
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}

    with Session(engine) as s:
        sj = s.get(SavedJob, saved_job_id)
        assert sj is not None
        assert sj.dismissed is True
        assert "below comp floor" in sj.dismiss_reason
        assert sj.decided_at is not None


def test_dismiss_without_body_still_works(seeded: tuple[int, int]) -> None:
    _, saved_job_id = seeded
    with TestClient(app) as client:
        r = client.patch(f"/api/jobs/{saved_job_id}/dismiss")
    assert r.status_code == 200
    with Session(engine) as s:
        sj = s.get(SavedJob, saved_job_id)
        assert sj is not None
        assert sj.dismissed is True
        assert sj.dismiss_reason == ""


def test_save_clears_reason_and_stamps(seeded: tuple[int, int]) -> None:
    _, saved_job_id = seeded
    with TestClient(app) as client:
        client.patch(f"/api/jobs/{saved_job_id}/dismiss", json={"reason": "no fit"})
        r = client.patch(f"/api/jobs/{saved_job_id}/save")
    assert r.status_code == 200
    with Session(engine) as s:
        sj = s.get(SavedJob, saved_job_id)
        assert sj is not None
        assert sj.dismissed is False
        assert sj.dismiss_reason == ""
        assert sj.decided_at is not None


def test_decision_log_returns_recent_decisions(seeded: tuple[int, int]) -> None:
    profile_id, saved_job_id = seeded
    with TestClient(app) as client:
        client.patch(
            f"/api/jobs/{saved_job_id}/dismiss",
            json={"reason": "remote-only"},
        )
        r = client.get(f"/api/jobs/decisions?profile_id={profile_id}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body) == 1
    entry = body[0]
    assert entry["saved_job_id"] == saved_job_id
    assert entry["decision"] == "dismissed"
    assert entry["reason"] == "remote-only"
    assert entry["title"] == "Backend Engineer"
    assert entry["decided_at"]


def test_decision_log_excludes_undecided(seeded: tuple[int, int]) -> None:
    profile_id, _ = seeded  # SavedJob exists but never dismissed/saved
    with TestClient(app) as client:
        r = client.get(f"/api/jobs/decisions?profile_id={profile_id}")
    assert r.status_code == 200
    assert r.json() == []
