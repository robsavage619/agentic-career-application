"""Interview prep — agent-driven, vault-grounded question + STAR answer generation."""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import PurePosixPath

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from api.agents import run_agent
from api.db import get_session
from api.models.interview_prep import InterviewPrep
from api.models.pipeline import PipelineCard
from api.models.profile import Profile
from api.services.rag import vault_write

# Profile is imported but only used in type hints; keep for clarity
_ = Profile

router = APIRouter()


class GenerateRequest(SQLModel):
    pipeline_card_id: int
    job_description: str = ""


class PrepOut(SQLModel):
    id: int
    pipeline_card_id: int
    content: str
    evidence: list[dict]
    vault_path: str
    created_at: str


def _to_out(p: InterviewPrep) -> PrepOut:
    try:
        evidence = json.loads(p.evidence_json) if p.evidence_json else []
    except (json.JSONDecodeError, ValueError):
        evidence = []
    return PrepOut(
        id=p.id or 0,
        pipeline_card_id=p.pipeline_card_id,
        content=p.content,
        evidence=evidence,
        vault_path=p.vault_path,
        created_at=p.created_at.isoformat(),
    )


@router.get("/{pipeline_card_id}")
def get_prep(
    pipeline_card_id: int,
    session: Session = Depends(get_session),
) -> PrepOut | None:
    p = session.exec(
        select(InterviewPrep)
        .where(InterviewPrep.pipeline_card_id == pipeline_card_id)
        .order_by(InterviewPrep.created_at.desc())  # type: ignore[attr-defined]
    ).first()
    return _to_out(p) if p else None


@router.post("/generate")
async def generate_prep(
    data: GenerateRequest,
    session: Session = Depends(get_session),
) -> PrepOut:
    card = session.get(PipelineCard, data.pipeline_card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Pipeline card not found")

    profile = session.get(Profile, card.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    rag_tag = profile.rag_tag or "rob"

    jd = (data.job_description or card.notes or "").strip()
    head = f"Role: {card.title}\nCompany: {card.company}\n\n"
    user_prompt = (
        f"{head}<job_description>\n{jd[:3000]}\n</job_description>\n\n"
        "Generate a focused interview prep doc:\n"
        "- 8-10 likely interview questions, grouped by category "
        "(behavioral, technical/domain, leadership, role-specific).\n"
        "- For each question, draft a STAR answer (Situation, Task, Action, "
        "Result) using SPECIFIC vault accomplishments. Cite the vault file in "
        "parentheses next to each claim.\n"
        "- 3 sharp questions to ask the interviewer that show domain depth.\n"
        "Format as clean markdown with ## headings."
    )

    result = await run_agent(
        mode="interview_prep",
        user_prompt=user_prompt,
        rag_tag=rag_tag,
        job_description=jd,
        extra={"job_title": card.title, "company": card.company},
    )

    output = result.get("output", "")
    evidence = result.get("evidence", [])

    prep = InterviewPrep(
        profile_id=card.profile_id,
        pipeline_card_id=card.id or 0,
        job_description=jd,
        content=output,
        evidence_json=json.dumps(evidence),
    )
    session.add(prep)
    session.commit()
    session.refresh(prep)
    return _to_out(prep)


@router.post("/{prep_id}/writeback")
async def writeback_prep(prep_id: int, session: Session = Depends(get_session)) -> dict:
    prep = session.get(InterviewPrep, prep_id)
    if not prep:
        raise HTTPException(status_code=404, detail="Not found")
    card = session.get(PipelineCard, prep.pipeline_card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Pipeline card not found")

    company = _slugify(card.company or "unknown")
    role = _slugify(card.title or "role")
    path = str(PurePosixPath("career") / f"{company}-{role}" / "interview-prep.md")

    body = (
        f"# Interview Prep — {card.title} @ {card.company}\n\n"
        f"_Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}_\n\n"
        f"{prep.content}\n"
    )
    written = await vault_write(path, body)

    if written:
        prep.vault_path = path
        session.add(prep)
        session.commit()
    return {"written": written, "path": path}


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(s: str) -> str:
    return _SLUG_RE.sub("-", s.lower()).strip("-") or "x"
