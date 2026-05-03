from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from api.db import get_session
from api.models.job import Job, SavedJob
from api.models.pipeline import PipelineCard, PipelineStage
from api.models.profile import Profile

router = APIRouter()

NEW_JOB_WINDOW_HOURS = 24
DEADLINE_WINDOW_HOURS = 24
STALLED_DAYS = 7
TERMINAL_STAGES: set[PipelineStage] = {PipelineStage.OFFER, PipelineStage.CLOSED}


# ── Briefing payload ────────────────────────────────────────────────────────

class BriefingJob(SQLModel):
    saved_job_id: int
    job_id: int
    title: str
    company: str
    location: str
    url: str
    score: float | None
    saved_at: str


class BriefingCard(SQLModel):
    card_id: int
    title: str
    company: str
    stage: PipelineStage
    url: str
    deadline: str | None
    days_since_update: int


class BriefingFollowUp(SQLModel):
    card_id: int
    title: str
    company: str
    stage: PipelineStage
    days_in_stage: int
    suggested_action: str


class BriefingCounts(SQLModel):
    new_jobs: int
    deadlines_today: int
    stalled_cards: int
    follow_ups: int
    pipeline_open: int


class Briefing(SQLModel):
    generated_at: str
    profile_id: int
    counts: BriefingCounts
    new_jobs: list[BriefingJob]
    deadlines_today: list[BriefingCard]
    stalled_cards: list[BriefingCard]
    follow_ups: list[BriefingFollowUp]


# ── Heuristics ──────────────────────────────────────────────────────────────

# Stage-specific cadence rules: ping after N days in this stage.
# Skip terminal stages (OFFER/CLOSED).
_FOLLOWUP_DAYS: dict[PipelineStage, int] = {
    PipelineStage.APPLIED: 7,
    PipelineStage.SCREENER: 4,
    PipelineStage.INTERVIEW: 3,
}

_FOLLOWUP_ACTIONS: dict[PipelineStage, str] = {
    PipelineStage.APPLIED: "Send a polite check-in to the recruiter.",
    PipelineStage.SCREENER: "Confirm next steps and timeline.",
    PipelineStage.INTERVIEW: "Send a thank-you and reiterate interest.",
}


# ── Endpoint ────────────────────────────────────────────────────────────────

@router.get("/")
def get_dashboard() -> dict:
    return {"insights": []}


@router.get("/briefing", response_model=Briefing)
def get_briefing(
    profile_id: int,
    session: Session = Depends(get_session),
) -> Briefing:
    profile = session.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    now = datetime.utcnow()
    new_cutoff = now - timedelta(hours=NEW_JOB_WINDOW_HOURS)
    deadline_cutoff = now + timedelta(hours=DEADLINE_WINDOW_HOURS)
    stalled_cutoff = now - timedelta(days=STALLED_DAYS)

    new_jobs = _fetch_new_jobs(session, profile_id, new_cutoff)
    deadlines = _fetch_deadlines(session, profile_id, now, deadline_cutoff)
    stalled = _fetch_stalled_cards(session, profile_id, stalled_cutoff, now)
    follow_ups = _fetch_follow_ups(session, profile_id, now)
    pipeline_open = _count_open_cards(session, profile_id)

    return Briefing(
        generated_at=now.isoformat(),
        profile_id=profile_id,
        counts=BriefingCounts(
            new_jobs=len(new_jobs),
            deadlines_today=len(deadlines),
            stalled_cards=len(stalled),
            follow_ups=len(follow_ups),
            pipeline_open=pipeline_open,
        ),
        new_jobs=new_jobs,
        deadlines_today=deadlines,
        stalled_cards=stalled,
        follow_ups=follow_ups,
    )


# ── Queries ─────────────────────────────────────────────────────────────────

def _fetch_new_jobs(
    session: Session, profile_id: int, since: datetime
) -> list[BriefingJob]:
    rows = session.exec(
        select(SavedJob, Job)
        .join(Job, SavedJob.job_id == Job.id)  # type: ignore[arg-type]
        .where(SavedJob.profile_id == profile_id)
        .where(SavedJob.dismissed == False)  # noqa: E712  -- SQLAlchemy boolean column
        .where(SavedJob.saved_at >= since)
        .order_by(SavedJob.score.desc().nulls_last(), SavedJob.saved_at.desc())  # type: ignore[union-attr]
    ).all()
    out: list[BriefingJob] = []
    for saved, job in rows:
        if saved.id is None or job.id is None:
            continue
        out.append(
            BriefingJob(
                saved_job_id=saved.id,
                job_id=job.id,
                title=job.title,
                company=job.company,
                location=job.location,
                url=job.url,
                score=saved.score,
                saved_at=saved.saved_at.isoformat(),
            )
        )
    return out


def _fetch_deadlines(
    session: Session, profile_id: int, now: datetime, until: datetime
) -> list[BriefingCard]:
    rows = session.exec(
        select(PipelineCard)
        .where(PipelineCard.profile_id == profile_id)
        .where(PipelineCard.deadline.is_not(None))  # type: ignore[union-attr]
        .where(PipelineCard.deadline <= until)  # type: ignore[operator]
        .where(PipelineCard.deadline >= now - timedelta(days=1))  # type: ignore[operator]
        .where(PipelineCard.stage.not_in(list(TERMINAL_STAGES)))  # type: ignore[union-attr]
        .order_by(PipelineCard.deadline.asc())  # type: ignore[union-attr]
    ).all()
    return [_card_to_briefing(c, now) for c in rows if c.id is not None]


def _fetch_stalled_cards(
    session: Session, profile_id: int, cutoff: datetime, now: datetime
) -> list[BriefingCard]:
    rows = session.exec(
        select(PipelineCard)
        .where(PipelineCard.profile_id == profile_id)
        .where(PipelineCard.updated_at <= cutoff)
        .where(PipelineCard.stage.not_in(list(TERMINAL_STAGES)))  # type: ignore[union-attr]
        .order_by(PipelineCard.updated_at.asc())  # type: ignore[attr-defined]
    ).all()
    return [_card_to_briefing(c, now) for c in rows if c.id is not None]


def _fetch_follow_ups(
    session: Session, profile_id: int, now: datetime
) -> list[BriefingFollowUp]:
    out: list[BriefingFollowUp] = []
    for stage, days in _FOLLOWUP_DAYS.items():
        cutoff = now - timedelta(days=days)
        rows = session.exec(
            select(PipelineCard)
            .where(PipelineCard.profile_id == profile_id)
            .where(PipelineCard.stage == stage)
            .where(PipelineCard.updated_at <= cutoff)
            .order_by(PipelineCard.updated_at.asc())  # type: ignore[attr-defined]
        ).all()
        for c in rows:
            if c.id is None:
                continue
            days_in = max(0, (now - c.updated_at).days)
            out.append(
                BriefingFollowUp(
                    card_id=c.id,
                    title=c.title,
                    company=c.company,
                    stage=c.stage,
                    days_in_stage=days_in,
                    suggested_action=_FOLLOWUP_ACTIONS[stage],
                )
            )
    return out


def _count_open_cards(session: Session, profile_id: int) -> int:
    rows = session.exec(
        select(PipelineCard.id)
        .where(PipelineCard.profile_id == profile_id)
        .where(PipelineCard.stage.not_in(list(TERMINAL_STAGES)))  # type: ignore[union-attr]
    ).all()
    return len(rows)


def _card_to_briefing(card: PipelineCard, now: datetime) -> BriefingCard:
    days_since = max(0, (now - card.updated_at).days)
    return BriefingCard(
        card_id=card.id,  # type: ignore[arg-type]
        title=card.title,
        company=card.company,
        stage=card.stage,
        url=card.url,
        deadline=card.deadline.isoformat() if card.deadline else None,
        days_since_update=days_since,
    )
