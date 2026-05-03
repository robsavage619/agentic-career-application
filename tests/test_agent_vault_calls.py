"""Vault-everywhere enforcement.

Per WORKFLOW.md: every advisory agent mode must consult the Obsidian vault
at least once before producing output. This test mocks the vault and the
LLM, runs each mode, and asserts vault_search was invoked. If a future mode
is added without wiring the vault, this test fails.
"""
from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from api.agents import run_agent
from api.agents.state import AgentMode

ALL_MODES: list[AgentMode] = [
    "rewrite_resume",
    "draft_cover_letter",
    "draft_linkedin_post",
    "analyze_jd",
    "score_match",
    "interview_prep",
    "explain_fit",
]


@pytest.mark.parametrize("mode", ALL_MODES)
async def test_every_mode_consults_vault(mode: AgentMode) -> None:
    fake_hits = [{"filename": "test.md", "context": "evidence chunk"}]
    with (
        patch("api.agents.tools.rag.vault_search", new=AsyncMock(return_value=fake_hits)) as vs,
        patch("api.agents.graph.ai.complete", new=AsyncMock(return_value="ok")) as llm,
    ):
        final = await run_agent(
            mode=mode,
            user_prompt="test",
            rag_tag="rob",
            job_description="Senior Python engineer building agentic systems.",
        )

    assert vs.await_count >= 1, f"mode={mode} did not call vault_search"
    assert llm.await_count == 1
    assert final.get("finalized") is True
    assert final.get("output") == "ok"
    # Tool call ledger captured for UI traces.
    assert any(tc["name"] == "vault_search" for tc in final.get("tool_calls", []))


async def test_evidence_passed_into_llm_context() -> None:
    fake_hits = [{"filename": "apex.md", "context": "Led APEX migration to Databricks."}]
    captured: dict[str, Any] = {}

    async def _fake_complete(*, system_persona: str, rag_context: str, **_: Any) -> str:
        captured["rag_context"] = rag_context
        captured["system_persona"] = system_persona
        return "ok"

    with (
        patch("api.agents.tools.rag.vault_search", new=AsyncMock(return_value=fake_hits)),
        patch("api.agents.graph.ai.complete", new=_fake_complete),
    ):
        await run_agent(
            mode="explain_fit",
            user_prompt="why this job",
            rag_tag="rob",
            job_description="Databricks platform lead.",
        )

    assert "apex.md" in captured["rag_context"]
    assert "APEX migration" in captured["rag_context"]
