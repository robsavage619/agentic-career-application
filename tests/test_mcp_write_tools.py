"""Phase 3 write MCP tools — exercised against real SQLite + a real DOCX."""
from __future__ import annotations

import io
import json
from typing import Any

import pytest
from docx import Document
from sqlmodel import Session, SQLModel

from api.db import engine, init_db
from api.models.cover_letter import CoverLetter
from api.models.interview_prep import InterviewPrep
from api.models.job import Job, SavedJob
from api.models.pipeline import PipelineCard, PipelineStage
from api.models.profile import Profile
from api.models.resume import BaseResume, ResumeVersion
from api.services import resume_engine
from mcp_server.server import mcp


@pytest.fixture(autouse=True)
def _reset_db() -> None:
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    init_db()


def _payload(result: Any) -> Any:
    structured = result[1] if isinstance(result, tuple) else result
    if isinstance(structured, dict) and "result" in structured:
        return structured["result"]
    if isinstance(structured, list) and structured and hasattr(structured[0], "text"):
        return json.loads(structured[0].text)
    return structured


def _make_docx(lines: list[str]) -> bytes:
    doc = Document()
    for line in lines:
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


@pytest.fixture
def seeded() -> dict[str, int]:
    with Session(engine) as s:
        p = Profile(name="Rob", rag_tag="rob")
        s.add(p)
        s.commit()
        s.refresh(p)

        j = Job(source="adzuna", external_id="x1", title="Staff", company="Acme")
        s.add(j)
        s.commit()
        s.refresh(j)

        sj = SavedJob(profile_id=p.id or 0, job_id=j.id or 0)
        s.add(sj)

        card = PipelineCard(
            profile_id=p.id or 0,
            job_id=j.id,
            title="Staff",
            company="Acme",
            stage=PipelineStage.APPLIED,
        )
        s.add(card)

        docx = _make_docx(["Old bullet one", "Old bullet two", "Old bullet three"])
        base = BaseResume(profile_id=p.id or 0, name="resume.docx", docx_bytes=docx)
        s.add(base)
        s.commit()
        s.refresh(base)

        version = ResumeVersion(base_resume_id=base.id or 0, docx_bytes=docx)
        s.add(version)
        s.commit()
        s.refresh(card)
        s.refresh(sj)
        s.refresh(version)

        assert p.id and card.id and sj.id and version.id and base.id
        return {
            "profile_id": p.id,
            "card_id": card.id,
            "saved_job_id": sj.id,
            "version_id": version.id,
            "base_resume_id": base.id,
        }


async def test_apply_resume_diff_forks_and_applies(seeded: dict[str, int]) -> None:
    out = _payload(
        await mcp.call_tool(
            "apply_resume_diff",
            {
                "version_id": seeded["version_id"],
                "line_replacements": {0: "New strong bullet ONE", 2: "New strong bullet THREE"},
                "pipeline_card_id": seeded["card_id"],
                "jd_snapshot": "JD blurb",
            },
        )
    )
    assert out["ok"] is True
    assert out["lines_changed"] == 2
    assert out["source_version_id"] == seeded["version_id"]
    assert out["version_id"] != seeded["version_id"]

    with Session(engine) as s:
        new_v = s.get(ResumeVersion, out["version_id"])
        assert new_v is not None
        lines = resume_engine.extract_lines(new_v.docx_bytes)
        assert lines == ["New strong bullet ONE", "Old bullet two", "New strong bullet THREE"]
        assert new_v.pipeline_card_id == seeded["card_id"]
        assert new_v.jd_snapshot == "JD blurb"

        original = s.get(ResumeVersion, seeded["version_id"])
        assert original is not None
        assert resume_engine.extract_lines(original.docx_bytes)[0] == "Old bullet one"


async def test_apply_resume_diff_accepts_string_keys(seeded: dict[str, int]) -> None:
    out = _payload(
        await mcp.call_tool(
            "apply_resume_diff",
            {
                "version_id": seeded["version_id"],
                "line_replacements": {"1": "Replaced via string key"},
            },
        )
    )
    assert out["ok"] is True
    with Session(engine) as s:
        v = s.get(ResumeVersion, out["version_id"])
        assert v is not None
        assert resume_engine.extract_lines(v.docx_bytes)[1] == "Replaced via string key"


async def test_apply_resume_diff_missing_version() -> None:
    out = _payload(
        await mcp.call_tool(
            "apply_resume_diff",
            {"version_id": 999, "line_replacements": {0: "x"}},
        )
    )
    assert out["ok"] is False
    assert "not found" in out["error"]


async def test_save_cover_letter_persists(seeded: dict[str, int]) -> None:
    out = _payload(
        await mcp.call_tool(
            "save_cover_letter",
            {
                "profile_id": seeded["profile_id"],
                "content": "Dear hiring team, ...",
                "pipeline_card_id": seeded["card_id"],
            },
        )
    )
    assert out["ok"] is True
    with Session(engine) as s:
        row = s.get(CoverLetter, out["cover_letter_id"])
        assert row is not None
        assert row.content.startswith("Dear")


async def test_save_cover_letter_rejects_empty(seeded: dict[str, int]) -> None:
    out = _payload(
        await mcp.call_tool(
            "save_cover_letter",
            {"profile_id": seeded["profile_id"], "content": "   "},
        )
    )
    assert out["ok"] is False


async def test_save_interview_prep_persists(seeded: dict[str, int]) -> None:
    out = _payload(
        await mcp.call_tool(
            "save_interview_prep",
            {
                "profile_id": seeded["profile_id"],
                "pipeline_card_id": seeded["card_id"],
                "content": "## Q1\nSTAR answer ...",
                "evidence_json": '[{"filename":"apex.md"}]',
            },
        )
    )
    assert out["ok"] is True
    with Session(engine) as s:
        row = s.get(InterviewPrep, out["interview_prep_id"])
        assert row is not None
        assert "STAR" in row.content
        assert "apex.md" in row.evidence_json


async def test_log_decision_dismiss_with_reason(seeded: dict[str, int]) -> None:
    out = _payload(
        await mcp.call_tool(
            "log_decision",
            {
                "saved_job_id": seeded["saved_job_id"],
                "decision": "dismissed",
                "reason": "below comp floor",
            },
        )
    )
    assert out["ok"] is True
    with Session(engine) as s:
        sj = s.get(SavedJob, seeded["saved_job_id"])
        assert sj is not None
        assert sj.dismissed is True
        assert sj.dismiss_reason == "below comp floor"
        assert sj.decided_at is not None


async def test_log_decision_save_clears_reason(seeded: dict[str, int]) -> None:
    await mcp.call_tool(
        "log_decision",
        {"saved_job_id": seeded["saved_job_id"], "decision": "dismissed", "reason": "x"},
    )
    out = _payload(
        await mcp.call_tool(
            "log_decision",
            {"saved_job_id": seeded["saved_job_id"], "decision": "saved"},
        )
    )
    assert out["ok"] is True
    with Session(engine) as s:
        sj = s.get(SavedJob, seeded["saved_job_id"])
        assert sj is not None
        assert sj.dismissed is False
        assert sj.dismiss_reason == ""


async def test_log_decision_rejects_bad_value(seeded: dict[str, int]) -> None:
    out = _payload(
        await mcp.call_tool(
            "log_decision",
            {"saved_job_id": seeded["saved_job_id"], "decision": "yolo"},
        )
    )
    assert out["ok"] is False


async def test_move_card_changes_stage(seeded: dict[str, int]) -> None:
    out = _payload(
        await mcp.call_tool(
            "move_card",
            {"card_id": seeded["card_id"], "new_stage": "INTERVIEW"},
        )
    )
    assert out["ok"] is True
    assert out["previous_stage"] == "APPLIED"
    assert out["new_stage"] == "INTERVIEW"
    with Session(engine) as s:
        c = s.get(PipelineCard, seeded["card_id"])
        assert c is not None
        assert c.stage == PipelineStage.INTERVIEW


async def test_move_card_rejects_bad_stage(seeded: dict[str, int]) -> None:
    out = _payload(
        await mcp.call_tool(
            "move_card",
            {"card_id": seeded["card_id"], "new_stage": "WONKY"},
        )
    )
    assert out["ok"] is False


async def test_list_resume_versions_filters(seeded: dict[str, int]) -> None:
    out = _payload(
        await mcp.call_tool(
            "list_resume_versions",
            {"base_resume_id": seeded["base_resume_id"]},
        )
    )
    assert len(out) == 1
    assert out[0]["id"] == seeded["version_id"]
