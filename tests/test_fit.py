"""Fit-scoring endpoint: agent integration + score parsing."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from api.db import engine, init_db
from api.main import app
from api.models.profile import Profile
from api.routers.fit import _extract_score, _extract_verdict


@pytest.fixture(autouse=True)
def _setup_db() -> None:
    init_db()


@pytest.fixture
def profile_id() -> int:
    with Session(engine) as session:
        p = Profile(name="Test", rag_tag="rob")
        session.add(p)
        session.commit()
        session.refresh(p)
        assert p.id is not None
        return p.id


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Score: 87/100\nverdict here", 87),
        ("score 42", 42),
        ("Final: 73 / 100 — solid fit", 73),
        ("no number here", None),
        ("Score: 250/100", None),  # out of range
    ],
)
def test_extract_score(text: str, expected: int | None) -> None:
    assert _extract_score(text) == expected


def test_extract_verdict_uses_last_meaningful_line() -> None:
    text = "Score: 80/100\nStrengths:\n- A\n- B\nVerdict: Strong fit; proceed to onsite prep."
    out = _extract_verdict(text)
    assert "Strong fit" in out


def test_score_endpoint_calls_agent_and_extracts_score(profile_id: int) -> None:
    fake_hits = [{"filename": "apex.md", "context": "Built APEX FinOps platform on Databricks."}]
    fake_output = (
        "Score: 82/100\n"
        "Strengths:\n- FinOps experience [apex.md]\n- Databricks fluency [apex.md]\n- Python depth [resume.md]\n"
        "Gaps:\n- No Kafka exposure (next: ship a small pipeline)\n- Limited mobile (next: skip)\n"
        "Verdict: Strong fit; emphasize the FinOps platform story."
    )
    with (
        patch("api.agents.tools.rag.vault_search", new=AsyncMock(return_value=fake_hits)),
        patch("api.agents.graph.ai.complete", new=AsyncMock(return_value=fake_output)),
        TestClient(app) as client,
    ):
        r = client.post(
                "/api/fit/score",
                json={
                    "profile_id": profile_id,
                    "job_description": "Senior Python engineer for a Databricks-based FinOps platform.",
                    "job_title": "Senior Engineer",
                    "company": "Acme",
                },
            )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["score"] == 82
    assert "Strong fit" in body["verdict"]
    assert any(e["filename"] == "apex.md" for e in body["evidence"])
    assert "Score:" in body["output"]
