"""Phase 2 read-only context tools.

Pure JSON over SQLite + DOCX. No model calls, no side effects. The chat-window
agent (Claude Code) uses these to gather context before reasoning.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from mcp.server.fastmcp import FastMCP
from sqlmodel import Session, select

from api.db import engine
from api.models.job import Job, SavedJob
from api.models.pipeline import PipelineCard, PipelineStage
from api.models.profile import Profile
from api.models.resume import ResumeVersion
from api.services import resume_engine


def _serialize_card(card: PipelineCard) -> dict[str, Any]:
    days_in_stage = (datetime.utcnow() - card.updated_at).days
    return {
        "id": card.id,
        "profile_id": card.profile_id,
        "job_id": card.job_id,
        "stage": str(card.stage),
        "title": card.title,
        "company": card.company,
        "url": card.url,
        "deadline": card.deadline.isoformat() if card.deadline else None,
        "notes": card.notes,
        "created_at": card.created_at.isoformat(),
        "updated_at": card.updated_at.isoformat(),
        "days_in_stage": days_in_stage,
    }


def _serialize_job(job: Job) -> dict[str, Any]:
    return {
        "id": job.id,
        "source": job.source,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "url": job.url,
        "description": job.description,
        "posted_at": job.posted_at.isoformat() if job.posted_at else None,
    }


def register(mcp: FastMCP) -> None:
    @mcp.tool()
    async def list_pipeline_cards(
        profile_id: int,
        stage: str = "",
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """List pipeline cards for a profile, newest first.

        Filter by `stage` (one of DISCOVERED/APPLIED/SCREENER/INTERVIEW/OFFER/CLOSED).
        Each card includes `days_in_stage` for stalled-card detection.
        """
        with Session(engine) as s:
            stmt = select(PipelineCard).where(PipelineCard.profile_id == profile_id)
            if stage:
                stmt = stmt.where(PipelineCard.stage == PipelineStage(stage))
            stmt = stmt.order_by(PipelineCard.created_at.desc()).limit(limit)  # type: ignore[arg-type]
            return [_serialize_card(c) for c in s.exec(stmt).all()]

    @mcp.tool()
    async def get_card(card_id: int) -> dict[str, Any]:
        """Fetch a single pipeline card with its linked job (if any).

        Returns `{card, job}` where `job` is null when the card was created
        without a job link.
        """
        with Session(engine) as s:
            card = s.get(PipelineCard, card_id)
            if not card:
                return {"card": None, "job": None}
            job = s.get(Job, card.job_id) if card.job_id else None
            return {
                "card": _serialize_card(card),
                "job": _serialize_job(job) if job else None,
            }

    @mcp.tool()
    async def get_profile(profile_id: int = 0) -> dict[str, Any]:
        """Fetch a profile by id. With profile_id=0, returns the first profile.

        Includes `rag_tag` — the substring used to scope vault searches to this
        person (e.g. 'rob' filters to Rob's notes).
        """
        with Session(engine) as s:
            profile: Profile | None
            if profile_id:
                profile = s.get(Profile, profile_id)
            else:
                profile = s.exec(select(Profile).order_by(Profile.id)).first()  # type: ignore[arg-type]
            if not profile:
                return {}
            return {
                "id": profile.id,
                "name": profile.name,
                "rag_tag": profile.rag_tag,
                "accent_color": profile.accent_color,
                "avatar_emoji": profile.avatar_emoji,
            }

    @mcp.tool()
    async def get_resume_lines(version_id: int) -> dict[str, Any]:
        """Extract numbered text lines from a saved ResumeVersion's DOCX.

        Returns `{version_id, lines: {idx: text}, jd_snapshot}`. The numbered
        dict matches the contract that `apply_resume_diff` expects (line index
        → replacement string).
        """
        with Session(engine) as s:
            version = s.get(ResumeVersion, version_id)
            if not version:
                return {"version_id": version_id, "lines": {}, "jd_snapshot": ""}
            lines = resume_engine.extract_lines(version.docx_bytes)
            return {
                "version_id": version_id,
                "lines": dict(enumerate(lines)),
                "jd_snapshot": version.jd_snapshot,
            }

    @mcp.tool()
    async def get_recent_jobs(
        profile_id: int,
        limit: int = 25,
        undecided_only: bool = True,
    ) -> list[dict[str, Any]]:
        """Recent jobs in this profile's feed.

        With `undecided_only=True` (default), excludes jobs the user has already
        dismissed or pushed to the pipeline.
        """
        with Session(engine) as s:
            stmt = (
                select(SavedJob, Job)
                .join(Job, SavedJob.job_id == Job.id)  # type: ignore[arg-type]
                .where(SavedJob.profile_id == profile_id)
            )
            if undecided_only:
                stmt = stmt.where(SavedJob.dismissed == False)  # noqa: E712
                stmt = stmt.where(SavedJob.decided_at.is_(None))  # type: ignore[union-attr]
            stmt = stmt.order_by(SavedJob.saved_at.desc()).limit(limit)  # type: ignore[arg-type]
            out: list[dict[str, Any]] = []
            for sj, job in s.exec(stmt).all():
                row = _serialize_job(job)
                row["saved_job_id"] = sj.id
                row["score"] = sj.score
                out.append(row)
            return out

    @mcp.tool()
    async def get_briefing_context(profile_id: int = 0) -> dict[str, Any]:
        """Raw inputs for a daily briefing: stage counts, stalled cards, recent decisions.

        No verdict, no narrative — Claude composes those in chat. This tool only
        returns the structured numbers the chat needs to reason from.
        """
        with Session(engine) as s:
            profile: Profile | None
            if profile_id:
                profile = s.get(Profile, profile_id)
            else:
                profile = s.exec(select(Profile).order_by(Profile.id)).first()  # type: ignore[arg-type]
            if not profile or profile.id is None:
                return {}
            pid = profile.id

            cards = list(
                s.exec(select(PipelineCard).where(PipelineCard.profile_id == pid)).all()
            )
            stage_counts: dict[str, int] = {}
            stalled: list[dict[str, Any]] = []
            now = datetime.utcnow()
            for c in cards:
                key = str(c.stage)
                stage_counts[key] = stage_counts.get(key, 0) + 1
                days = (now - c.updated_at).days
                if days >= 7 and c.stage not in (PipelineStage.OFFER, PipelineStage.CLOSED):
                    stalled.append(
                        {
                            "card_id": c.id,
                            "title": c.title,
                            "company": c.company,
                            "stage": str(c.stage),
                            "days_in_stage": days,
                        }
                    )

            recent_decisions = s.exec(
                select(SavedJob, Job)
                .join(Job, SavedJob.job_id == Job.id)  # type: ignore[arg-type]
                .where(SavedJob.profile_id == pid)
                .where(SavedJob.decided_at.is_not(None))  # type: ignore[union-attr]
                .order_by(SavedJob.decided_at.desc())  # type: ignore[union-attr]
                .limit(5)
            ).all()

            return {
                "profile": {
                    "id": profile.id,
                    "name": profile.name,
                    "rag_tag": profile.rag_tag,
                },
                "stage_counts": stage_counts,
                "total_cards": len(cards),
                "stalled_cards": stalled,
                "recent_decisions": [
                    {
                        "title": job.title,
                        "company": job.company,
                        "decision": "dismissed" if sj.dismissed else "saved",
                        "reason": sj.dismiss_reason,
                        "decided_at": sj.decided_at.isoformat() if sj.decided_at else None,
                    }
                    for sj, job in recent_decisions
                ],
            }
