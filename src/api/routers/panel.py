from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from api.db import get_session
from api.models.panel import PanelSession
from api.models.profile import Profile
from api.services import anthropic as ai
from api.services import rag

router = APIRouter()

# ── Persona definitions ──────────────────────────────────────────────────────

PERSONAS: list[dict] = [
    {
        "id": "recruiter",
        "name": "The Recruiter",
        "focus": "First-impression screening, ATS keywords, clarity, positioning",
        "system": (
            "You are an experienced recruiter who screens 200+ resumes per week. "
            "You evaluate for first-impression impact, ATS keyword coverage, clarity, "
            "and whether the document passes a 10-second scan. Be direct, specific, constructive."
        ),
    },
    {
        "id": "hiring_manager",
        "name": "The Hiring Manager",
        "focus": "Cultural fit, impact framing, specificity, leadership signals",
        "system": (
            "You are a hiring manager who evaluates for team fit, impact evidence, "
            "and whether the candidate can actually do the job. You want specifics — "
            "metrics, ownership, outcomes. Be candid about what's missing."
        ),
    },
    {
        "id": "career_coach",
        "name": "The Career Coach",
        "focus": "Narrative arc, career positioning, gap strategy, story coherence",
        "system": (
            "You are a senior career coach specializing in career transitions and positioning. "
            "You evaluate the overall narrative: does it tell a coherent, compelling story? "
            "Is the candidate's unique value proposition clear? Surface blind spots."
        ),
    },
    {
        "id": "market_analyst",
        "name": "The Market Analyst",
        "focus": "Skills relevance, sector timing, competitive angle, market fit",
        "system": (
            "You are a labor market analyst who understands talent supply/demand dynamics. "
            "You evaluate whether the candidate's skills match current market demand, "
            "identify gaps vs. target-role requirements, and assess competitive positioning."
        ),
    },
    {
        "id": "tech_lead",
        "name": "The Tech Lead",
        "focus": "Technical depth, architecture credibility, AI/ML specificity",
        "system": (
            "You are a principal engineer and technical hiring bar-raiser. "
            "You evaluate technical claims for credibility and depth. You spot vague buzzwords "
            "vs. real experience. For AI/ML roles, you look for systems thinking and specificity."
        ),
    },
]

_REVIEW_PROMPT = """\
Review the following {doc_type}. Provide:
1. **Strengths** (2-3 bullets): What works well.
2. **Concerns** (2-3 bullets): Specific, actionable issues.
3. **Top rewrite** (1 item): The single highest-impact change to make.

Be specific. Reference actual text from the document. No generic advice.

<document>
{document}
</document>
"""


async def _run_persona(
    persona: dict,
    doc_type: str,
    document: str,
    rag_ctx: str,
) -> tuple[str, str]:
    """Returns (persona_id, review_text)."""
    review = await ai.complete(
        system_persona=persona["system"],
        rag_context=rag_ctx,
        user_prompt=_REVIEW_PROMPT.format(doc_type=doc_type, document=document[:4000]),
        model="claude-sonnet-4-6",
        max_tokens=1024,
    )
    return persona["id"], review


# ── Models ───────────────────────────────────────────────────────────────────

class SessionCreate(SQLModel):
    profile_id: int
    document_type: str
    document_snapshot: str


class SessionOut(SQLModel):
    id: int
    profile_id: int
    document_type: str
    document_snapshot: str
    reviews_json: str
    created_at: str


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/")
def list_sessions(
    profile_id: int,
    session: Session = Depends(get_session),
) -> list[SessionOut]:
    rows = session.exec(
        select(PanelSession)
        .where(PanelSession.profile_id == profile_id)
        .order_by(PanelSession.created_at.desc())  # type: ignore[arg-type]
    ).all()
    return [
        SessionOut(
            id=r.id,  # type: ignore[arg-type]
            profile_id=r.profile_id,
            document_type=r.document_type,
            document_snapshot=r.document_snapshot[:200],
            reviews_json=r.reviews_json,
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


@router.post("/", status_code=201)
async def create_session(
    data: SessionCreate,
    session: Session = Depends(get_session),
) -> SessionOut:
    profile = session.get(Profile, data.profile_id)
    rag_tag = profile.rag_tag if profile else "rob"

    rag_ctx = await rag.search(
        query=f"accomplishments experience {data.document_type}",
        rag_tag=rag_tag,
    )

    # Run all 5 personas in parallel
    results = await asyncio.gather(
        *[
            _run_persona(p, data.document_type, data.document_snapshot, rag_ctx)
            for p in PERSONAS
        ],
        return_exceptions=True,
    )

    reviews: dict[str, str] = {}
    for result in results:
        if isinstance(result, tuple):
            pid, review = result
            reviews[pid] = review
        # swallow individual persona errors — partial results are still useful

    ps = PanelSession(
        profile_id=data.profile_id,
        document_type=data.document_type,
        document_snapshot=data.document_snapshot,
        reviews_json=json.dumps(reviews),
    )
    session.add(ps)
    session.commit()
    session.refresh(ps)

    return SessionOut(
        id=ps.id,  # type: ignore[arg-type]
        profile_id=ps.profile_id,
        document_type=ps.document_type,
        document_snapshot=ps.document_snapshot[:200],
        reviews_json=ps.reviews_json,
        created_at=ps.created_at.isoformat(),
    )


@router.get("/{session_id}")
def get_session_detail(
    session_id: int,
    session: Session = Depends(get_session),
) -> SessionOut:
    ps = session.get(PanelSession, session_id)
    if not ps:
        raise HTTPException(status_code=404, detail="Not found")
    return SessionOut(
        id=ps.id,  # type: ignore[arg-type]
        profile_id=ps.profile_id,
        document_type=ps.document_type,
        document_snapshot=ps.document_snapshot[:200],
        reviews_json=ps.reviews_json,
        created_at=ps.created_at.isoformat(),
    )


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: int, session: Session = Depends(get_session)) -> None:
    ps = session.get(PanelSession, session_id)
    if not ps:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(ps)
    session.commit()
