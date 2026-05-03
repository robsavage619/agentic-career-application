"""Phase 3 write tools — deterministic side-effects only, no model calls.

The chat-window agent reasons; these tools commit. Always create new rows
rather than overwriting (history-preserving). Validation lives here, not in
the chat — Claude can't be the only thing standing between a typo and the DB.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from mcp.server.fastmcp import FastMCP
from sqlmodel import Session, select

from api.db import engine
from api.models.cover_letter import CoverLetter
from api.models.interview_prep import InterviewPrep
from api.models.job import SavedJob
from api.models.pipeline import PipelineCard, PipelineStage
from api.models.resume import ResumeVersion
from api.services import resume_engine

_VALID_STAGES = {s.value for s in PipelineStage}
_VALID_DECISIONS = {"saved", "dismissed"}


def register(mcp: FastMCP) -> None:
    @mcp.tool()
    async def apply_resume_diff(
        version_id: int,
        line_replacements: dict[int, str],
        pipeline_card_id: int | None = None,
        jd_snapshot: str = "",
    ) -> dict[str, Any]:
        """Fork a ResumeVersion with chat-supplied line edits.

        Reads the source DOCX, applies `line_replacements` (0-indexed line ->
        new text), saves a new ResumeVersion. Always creates a new row — the
        original is preserved. Returns the new version_id and a count of lines
        actually changed.

        `line_replacements` keys can be int or string-int (FastMCP may serialize
        dict keys as strings); both are accepted.
        """
        normalized: dict[int, str] = {}
        for k, v in line_replacements.items():
            try:
                normalized[int(k)] = v
            except (TypeError, ValueError):
                continue

        with Session(engine) as s:
            source = s.get(ResumeVersion, version_id)
            if not source:
                return {"ok": False, "error": f"version {version_id} not found"}

            new_bytes = resume_engine.apply_line_replacements(
                source.docx_bytes, normalized
            )

            forked = ResumeVersion(
                base_resume_id=source.base_resume_id,
                pipeline_card_id=pipeline_card_id or source.pipeline_card_id,
                docx_bytes=new_bytes,
                jd_snapshot=jd_snapshot or source.jd_snapshot,
            )
            s.add(forked)
            s.commit()
            s.refresh(forked)
            return {
                "ok": True,
                "version_id": forked.id,
                "source_version_id": version_id,
                "lines_changed": len(normalized),
                "diff_url": f"/resume/diff/{forked.id}",
            }

    @mcp.tool()
    async def save_cover_letter(
        profile_id: int,
        content: str,
        pipeline_card_id: int | None = None,
    ) -> dict[str, Any]:
        """Persist a chat-drafted cover letter. Always creates a new row."""
        if not content.strip():
            return {"ok": False, "error": "content is empty"}
        with Session(engine) as s:
            row = CoverLetter(
                profile_id=profile_id,
                pipeline_card_id=pipeline_card_id,
                content=content,
            )
            s.add(row)
            s.commit()
            s.refresh(row)
            return {"ok": True, "cover_letter_id": row.id}

    @mcp.tool()
    async def save_interview_prep(
        profile_id: int,
        pipeline_card_id: int,
        content: str,
        job_description: str = "",
        evidence_json: str = "",
    ) -> dict[str, Any]:
        """Persist chat-drafted interview prep (questions + STAR answers).

        `evidence_json` is the raw vault hits the chat used — stored so the
        panel viewer can render citations later. Always creates a new row.
        """
        if not content.strip():
            return {"ok": False, "error": "content is empty"}
        with Session(engine) as s:
            row = InterviewPrep(
                profile_id=profile_id,
                pipeline_card_id=pipeline_card_id,
                content=content,
                job_description=job_description,
                evidence_json=evidence_json,
            )
            s.add(row)
            s.commit()
            s.refresh(row)
            return {"ok": True, "interview_prep_id": row.id}

    @mcp.tool()
    async def log_decision(
        saved_job_id: int,
        decision: str,
        reason: str = "",
    ) -> dict[str, Any]:
        """Mark a SavedJob as 'dismissed' or 'saved' with a one-line reason.

        Mirrors the existing decision-log writer. The reason feeds preference
        learning — the chat should always pass *why*.
        """
        if decision not in _VALID_DECISIONS:
            return {"ok": False, "error": f"decision must be one of {_VALID_DECISIONS}"}
        with Session(engine) as s:
            sj = s.get(SavedJob, saved_job_id)
            if not sj:
                return {"ok": False, "error": f"saved_job {saved_job_id} not found"}
            sj.dismissed = decision == "dismissed"
            sj.dismiss_reason = reason.strip() if sj.dismissed else ""
            sj.decided_at = datetime.utcnow()
            s.add(sj)
            s.commit()
            return {"ok": True, "saved_job_id": saved_job_id, "decision": decision}

    @mcp.tool()
    async def move_card(card_id: int, new_stage: str) -> dict[str, Any]:
        """Move a pipeline card to a new stage.

        `new_stage` must be one of DISCOVERED/APPLIED/SCREENER/INTERVIEW/OFFER/CLOSED.
        Updates `updated_at` so days_in_stage resets.
        """
        if new_stage not in _VALID_STAGES:
            return {"ok": False, "error": f"new_stage must be one of {_VALID_STAGES}"}
        with Session(engine) as s:
            card = s.get(PipelineCard, card_id)
            if not card:
                return {"ok": False, "error": f"card {card_id} not found"}
            previous = str(card.stage)
            card.stage = PipelineStage(new_stage)
            card.updated_at = datetime.utcnow()
            s.add(card)
            s.commit()
            return {
                "ok": True,
                "card_id": card_id,
                "previous_stage": previous,
                "new_stage": new_stage,
            }

    @mcp.tool()
    async def list_resume_versions(
        base_resume_id: int = 0,
        pipeline_card_id: int = 0,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """List ResumeVersion rows, newest first. Filter by base or card.

        Helper for the chat to find the right `version_id` to fork from when
        Rob says 'rewrite my resume for card 47'.
        """
        with Session(engine) as s:
            stmt = select(ResumeVersion)
            if base_resume_id:
                stmt = stmt.where(ResumeVersion.base_resume_id == base_resume_id)
            if pipeline_card_id:
                stmt = stmt.where(ResumeVersion.pipeline_card_id == pipeline_card_id)
            stmt = stmt.order_by(ResumeVersion.created_at.desc()).limit(limit)  # type: ignore[arg-type]
            return [
                {
                    "id": v.id,
                    "base_resume_id": v.base_resume_id,
                    "pipeline_card_id": v.pipeline_card_id,
                    "created_at": v.created_at.isoformat(),
                    "jd_snapshot_preview": v.jd_snapshot[:200],
                }
                for v in s.exec(stmt).all()
            ]
