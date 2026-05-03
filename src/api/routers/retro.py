"""Outcome retrospective — agent-driven post-mortem on pipeline cards.

Triggered manually when a card lands in OFFER or CLOSED. Agent reviews the
JD, the journey through stages, the resume version + cover letter generated,
and any interview prep — produces a retro markdown with what worked, what
to repeat, what to avoid. Writes to vault under career/<company>-<role>/.
"""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import PurePosixPath

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from api.agents import run_agent
from api.db import get_session
from api.models.cover_letter import CoverLetter
from api.models.interview_prep import InterviewPrep
from api.models.pipeline import PipelineCard, PipelineStage
from api.models.profile import Profile
from api.models.resume import ResumeVersion
from api.services.rag import vault_write

router = APIRouter()


class RetroRequest(SQLModel):
    pipeline_card_id: int
    outcome: str = ""  # offer / rejection / withdrew / ghosted — free text


class RetroResponse(SQLModel):
    content: str
    evidence: list[dict]
    written: bool
    path: str


@router.post("/generate", response_model=RetroResponse)
async def generate_retro(
    data: RetroRequest,
    session: Session = Depends(get_session),
) -> RetroResponse:
    card = session.get(PipelineCard, data.pipeline_card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Pipeline card not found")
    if card.stage not in (PipelineStage.OFFER, PipelineStage.CLOSED):
        raise HTTPException(
            status_code=409,
            detail="Retrospective is for terminal cards (OFFER or CLOSED) only",
        )

    profile = session.get(Profile, card.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    rag_tag = profile.rag_tag or "rob"

    # Gather the artifacts that were generated for this card
    versions = session.exec(
        select(ResumeVersion).where(ResumeVersion.pipeline_card_id == card.id)
    ).all()
    letters = session.exec(
        select(CoverLetter).where(CoverLetter.pipeline_card_id == card.id)
    ).all()
    prep = session.exec(
        select(InterviewPrep)
        .where(InterviewPrep.pipeline_card_id == card.id)
        .order_by(InterviewPrep.created_at.desc())  # type: ignore[attr-defined]
    ).first()

    artifacts = (
        f"- Resume versions tailored: {len(versions)}\n"
        f"- Cover letters drafted: {len(letters)}\n"
        f"- Interview prep doc: {'yes' if prep else 'no'}\n"
    )
    days_alive = (datetime.utcnow() - card.created_at).days

    head = f"Role: {card.title}\nCompany: {card.company}\nFinal stage: {card.stage.value}\n\n"
    user_prompt = (
        f"{head}<context>\n"
        f"This pipeline card lasted {days_alive} days. "
        f"Reported outcome: {data.outcome or 'not specified'}.\n"
        f"Artifacts generated:\n{artifacts}\n"
        f"Card notes:\n{card.notes[:1500]}\n"
        f"</context>\n\n"
        "Write a sharp, honest retrospective in markdown:\n"
        "1. **What worked** — 3-5 bullets, vault-cited where applicable.\n"
        "2. **What to repeat** — concrete patterns or moves worth doing again.\n"
        "3. **What to avoid** — friction points, mistakes, time sinks.\n"
        "4. **Net learning** — one paragraph distilling what this opportunity "
        "taught about your approach, your network, or what role/company shape "
        "is right for you.\n"
        "Keep it tight; this is for offline reading later. Cite vault files "
        "in parentheses next to claims that come from them."
    )

    result = await run_agent(
        mode="interview_prep",  # Reuse Sonnet, vault-grounded mode
        user_prompt=user_prompt,
        rag_tag=rag_tag,
        job_description=card.notes or "",
        extra={"job_title": card.title, "company": card.company},
    )
    output = result.get("output", "")
    evidence = result.get("evidence", [])

    # Vault writeback
    company = _slugify(card.company or "unknown")
    role = _slugify(card.title or "role")
    path = str(PurePosixPath("career") / f"{company}-{role}" / "retrospective.md")
    body = (
        f"# Retrospective — {card.title} @ {card.company}\n\n"
        f"_Outcome: {data.outcome or card.stage.value} · "
        f"{days_alive} days in pipeline · "
        f"{datetime.utcnow().strftime('%Y-%m-%d')}_\n\n"
        f"{output}\n"
    )
    written = await vault_write(path, body)
    return RetroResponse(content=output, evidence=evidence, written=written, path=path)


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(s: str) -> str:
    return _SLUG_RE.sub("-", s.lower()).strip("-") or "x"
