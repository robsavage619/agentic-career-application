"""Phase 2 read-only MCP tools — exercised against the real SQLite layer."""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

import pytest
from sqlmodel import Session, SQLModel

from api.db import engine, init_db
from api.models.job import Job, SavedJob
from api.models.pipeline import PipelineCard, PipelineStage
from api.models.profile import Profile
from mcp_server.server import mcp


@pytest.fixture(autouse=True)
def _reset_db() -> None:
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    init_db()


def _payload(result: Any) -> Any:
    """Unwrap FastMCP's (content_list, structured_dict) tuple."""
    structured = result[1] if isinstance(result, tuple) else result
    if isinstance(structured, dict) and "result" in structured:
        return structured["result"]
    if isinstance(structured, list) and structured and hasattr(structured[0], "text"):
        return json.loads(structured[0].text)
    return structured


@pytest.fixture
def seeded() -> dict[str, int]:
    with Session(engine) as s:
        p = Profile(name="Rob", rag_tag="rob")
        s.add(p)
        s.commit()
        s.refresh(p)

        j = Job(
            source="adzuna",
            external_id="x1",
            title="Staff ML Engineer",
            company="Acme",
            description="LLM agents, RAG, evals.",
        )
        s.add(j)
        s.commit()
        s.refresh(j)

        s.add(SavedJob(profile_id=p.id or 0, job_id=j.id or 0, score=0.82))
        # Stalled card (10 days old).
        old = datetime.utcnow() - timedelta(days=10)
        c = PipelineCard(
            profile_id=p.id or 0,
            job_id=j.id,
            title="Staff ML Engineer",
            company="Acme",
            stage=PipelineStage.APPLIED,
            created_at=old,
            updated_at=old,
        )
        s.add(c)
        s.commit()
        s.refresh(c)
        assert p.id and j.id and c.id
        return {"profile_id": p.id, "job_id": j.id, "card_id": c.id}


async def test_get_profile_defaults_to_first(seeded: dict[str, int]) -> None:
    out = _payload(await mcp.call_tool("get_profile", {}))
    assert out["id"] == seeded["profile_id"]
    assert out["rag_tag"] == "rob"


async def test_list_pipeline_cards_filters_by_stage(seeded: dict[str, int]) -> None:
    cards = _payload(
        await mcp.call_tool(
            "list_pipeline_cards",
            {"profile_id": seeded["profile_id"], "stage": "APPLIED"},
        )
    )
    assert len(cards) == 1
    assert cards[0]["id"] == seeded["card_id"]
    assert cards[0]["days_in_stage"] >= 10

    none = _payload(
        await mcp.call_tool(
            "list_pipeline_cards",
            {"profile_id": seeded["profile_id"], "stage": "OFFER"},
        )
    )
    assert none == []


async def test_get_card_includes_linked_job(seeded: dict[str, int]) -> None:
    out = _payload(await mcp.call_tool("get_card", {"card_id": seeded["card_id"]}))
    assert out["card"]["id"] == seeded["card_id"]
    assert out["job"]["title"] == "Staff ML Engineer"
    assert "RAG" in out["job"]["description"]


async def test_get_recent_jobs_undecided_only(seeded: dict[str, int]) -> None:
    jobs = _payload(
        await mcp.call_tool("get_recent_jobs", {"profile_id": seeded["profile_id"]})
    )
    assert len(jobs) == 1
    assert jobs[0]["title"] == "Staff ML Engineer"
    assert jobs[0]["score"] == pytest.approx(0.82)


async def test_get_briefing_context_surfaces_stalled(seeded: dict[str, int]) -> None:
    out = _payload(
        await mcp.call_tool("get_briefing_context", {"profile_id": seeded["profile_id"]})
    )
    assert out["stage_counts"] == {"APPLIED": 1}
    assert out["total_cards"] == 1
    assert len(out["stalled_cards"]) == 1
    assert out["stalled_cards"][0]["card_id"] == seeded["card_id"]
    assert out["stalled_cards"][0]["days_in_stage"] >= 10
