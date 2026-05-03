"""Vault writeback: helper + briefing endpoint."""
from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from api.db import engine, init_db
from api.main import app
from api.models.job import Job, SavedJob
from api.models.pipeline import PipelineCard, PipelineStage
from api.models.profile import Profile
from api.services import rag


@pytest.fixture(autouse=True)
def _reset_db() -> None:
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


# ── vault_write helper ──────────────────────────────────────────────────────

async def test_vault_write_rejects_traversal() -> None:
    assert await rag.vault_write("../etc/passwd", "x") is False
    assert await rag.vault_write("/abs/path.md", "x") is False
    assert await rag.vault_write("", "x") is False


async def test_vault_write_returns_true_on_2xx() -> None:
    fake_response = httpx.Response(204)
    async def _fake_put(self, url, content=None, headers=None):  # type: ignore[no-untyped-def]
        return fake_response
    with patch("httpx.AsyncClient.put", new=_fake_put):
        ok = await rag.vault_write("career/test.md", "hello")
    assert ok is True


async def test_vault_write_returns_false_on_4xx() -> None:
    fake_response = httpx.Response(403, text="forbidden")
    async def _fake_put(self, url, content=None, headers=None):  # type: ignore[no-untyped-def]
        return fake_response
    with patch("httpx.AsyncClient.put", new=_fake_put):
        ok = await rag.vault_write("career/test.md", "hello")
    assert ok is False


async def test_vault_write_handles_network_error() -> None:
    async def _boom(self, url, content=None, headers=None):  # type: ignore[no-untyped-def]
        raise httpx.ConnectError("boom")
    with patch("httpx.AsyncClient.put", new=_boom):
        ok = await rag.vault_write("career/test.md", "hello")
    assert ok is False


# ── Briefing writeback endpoint ─────────────────────────────────────────────

def _seed_minimal(profile_id: int) -> None:
    with Session(engine) as s:
        j = Job(source="adzuna", external_id="x", title="SRE Lead", company="Acme")
        s.add(j)
        s.commit()
        s.refresh(j)
        sj = SavedJob(profile_id=profile_id, job_id=j.id or 0, score=0.91)
        sj.saved_at = datetime.utcnow() - timedelta(hours=2)
        s.add(sj)

        c = PipelineCard(
            profile_id=profile_id,
            title="Backend Engineer",
            company="Beta",
            stage=PipelineStage.INTERVIEW,
            deadline=datetime.utcnow() + timedelta(hours=6),
        )
        s.add(c)
        s.commit()


def test_briefing_writeback_renders_markdown_and_calls_vault(profile_id: int) -> None:
    _seed_minimal(profile_id)
    captured: dict[str, str] = {}

    async def _fake_write(path: str, content: str) -> bool:
        captured["path"] = path
        captured["content"] = content
        return True

    with (
        patch("api.routers.dashboard.rag.vault_write", new=_fake_write),
        TestClient(app) as client,
    ):
        r = client.post(f"/api/dashboard/briefing/writeback?profile_id={profile_id}")

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["written"] is True
    assert body["path"].startswith("career/briefings/")
    assert body["path"].endswith(".md")

    md = captured["content"]
    assert "# Daily Briefing" in md
    assert "## New jobs (24h)" in md
    assert "SRE Lead" in md
    assert "## Deadlines today" in md
    assert "Backend Engineer" in md
    assert "tags: [career/briefing]" in md


def test_briefing_writeback_returns_written_false_when_vault_offline(profile_id: int) -> None:
    async def _fake_write(path: str, content: str) -> bool:
        return False

    with (
        patch("api.routers.dashboard.rag.vault_write", new=_fake_write),
        TestClient(app) as client,
    ):
        r = client.post(f"/api/dashboard/briefing/writeback?profile_id={profile_id}")

    assert r.status_code == 200
    assert r.json()["written"] is False


# ── Explain endpoint ────────────────────────────────────────────────────────

def test_explain_endpoint_returns_output_and_evidence(profile_id: int) -> None:
    fake_hits = [{"filename": "apex.md", "context": "Built APEX FinOps platform."}]
    fake_output = (
        "Why it fits:\n"
        "- FinOps depth (apex.md)\n- Python fluency (resume.md)\n- Databricks (apex.md)\n\n"
        "Risks:\n- New domain (legal tech) — ramp-up\n- Smaller team than current"
    )
    with (
        patch("api.agents.tools.rag.vault_search", new=AsyncMock(return_value=fake_hits)),
        patch("api.agents.graph.ai.complete", new=AsyncMock(return_value=fake_output)),
        TestClient(app) as client,
    ):
        r = client.post(
            "/api/fit/explain",
            json={
                "profile_id": profile_id,
                "job_description": "Build the FinOps platform.",
                "job_title": "Staff Engineer",
                "company": "Acme",
            },
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "FinOps depth" in body["output"]
    assert "Risks:" in body["output"]
    assert any(e["filename"] == "apex.md" for e in body["evidence"])
