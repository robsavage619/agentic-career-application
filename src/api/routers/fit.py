from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel

from api.agents import run_agent
from api.db import get_session
from api.models.profile import Profile

router = APIRouter()


class FitRequest(SQLModel):
    profile_id: int
    job_description: str
    job_title: str = ""
    company: str = ""


class EvidenceItem(SQLModel):
    filename: str
    context: str


class FitResponse(SQLModel):
    score: int | None
    verdict: str
    output: str
    evidence: list[EvidenceItem]


class ExplainResponse(SQLModel):
    output: str
    evidence: list[EvidenceItem]


_SCORE_RE = re.compile(r"\b(?:score[:\s]*)?(\d{1,3})\s*/\s*100\b", re.IGNORECASE)
_PLAIN_SCORE_RE = re.compile(r"\bscore[:\s]+(\d{1,3})\b", re.IGNORECASE)


def _extract_score(text: str) -> int | None:
    for rx in (_SCORE_RE, _PLAIN_SCORE_RE):
        m = rx.search(text)
        if m:
            n = int(m.group(1))
            if 0 <= n <= 100:
                return n
    return None


def _extract_verdict(text: str) -> str:
    for raw in reversed(text.strip().splitlines()):
        line = raw.strip(" -*•").strip()
        if 20 <= len(line) <= 280:
            return line
    return ""


def _dedupe_evidence(raw: list[dict]) -> list[EvidenceItem]:
    seen: set[str] = set()
    out: list[EvidenceItem] = []
    for hit in raw:
        filename = hit.get("filename", "")
        context = (hit.get("context") or "").strip()
        key = f"{filename}::{context[:60]}"
        if not context or key in seen:
            continue
        seen.add(key)
        out.append(EvidenceItem(filename=filename, context=context))
    return out


@router.post("/score")
async def score_fit(
    data: FitRequest,
    session: Session = Depends(get_session),
) -> FitResponse:
    profile = session.get(Profile, data.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    rag_tag = profile.rag_tag or "rob"

    head = (
        f"Role: {data.job_title}\nCompany: {data.company}\n\n"
        if data.job_title or data.company
        else ""
    )
    user_prompt = (
        f"{head}<job_description>\n{data.job_description[:3000]}\n</job_description>\n\n"
        "Score this fit and return: a 0-100 score (format 'Score: NN/100'), "
        "three strengths with vault citations, two gaps with concrete next actions, "
        "and a one-line verdict on the last line."
    )

    final = await run_agent(
        mode="score_match",
        user_prompt=user_prompt,
        rag_tag=rag_tag,
        job_description=data.job_description,
    )
    output = final.get("output", "")

    return FitResponse(
        score=_extract_score(output),
        verdict=_extract_verdict(output),
        output=output,
        evidence=_dedupe_evidence(list(final.get("evidence", []))),
    )


@router.post("/explain")
async def explain_fit(
    data: FitRequest,
    session: Session = Depends(get_session),
) -> ExplainResponse:
    """Quick "Why this job?" — three bullets fit, two risks, vault-cited.

    Uses the explain_fit agent mode (Haiku, ~800 tokens) so it's cheap to
    run inline on every feed card.
    """
    profile = session.get(Profile, data.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    rag_tag = profile.rag_tag or "rob"

    head = (
        f"Role: {data.job_title}\nCompany: {data.company}\n\n"
        if data.job_title or data.company
        else ""
    )
    user_prompt = (
        f"{head}<job_description>\n{data.job_description[:2500]}\n</job_description>\n\n"
        "Three bullets why this fits, then two bullets on real risks. "
        "Cite vault notes by filename. No fluff."
    )

    final = await run_agent(
        mode="explain_fit",
        user_prompt=user_prompt,
        rag_tag=rag_tag,
        job_description=data.job_description,
    )
    return ExplainResponse(
        output=final.get("output", ""),
        evidence=_dedupe_evidence(list(final.get("evidence", []))),
    )
