from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from api.db import get_session
from api.models.job import Job, SavedJob
from api.models.pipeline import PipelineCard, PipelineStage
from api.models.profile import Profile
from api.services import rag

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


class WritebackResponse(SQLModel):
    written: bool
    path: str


def _build_briefing(session: Session, profile: Profile) -> Briefing:
    profile_id = profile.id or 0
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


@router.get("/briefing", response_model=Briefing)
def get_briefing(
    profile_id: int,
    session: Session = Depends(get_session),
) -> Briefing:
    profile = session.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _build_briefing(session, profile)


@router.post("/briefing/writeback", response_model=WritebackResponse)
async def writeback_briefing(
    profile_id: int,
    session: Session = Depends(get_session),
) -> WritebackResponse:
    """Render today's briefing as markdown and write it to the Obsidian vault.

    Path: `career/briefings/YYYY-MM-DD.md` (overwrites if same-day).
    """
    profile = session.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    briefing = _build_briefing(session, profile)
    path = f"career/briefings/{datetime.utcnow().date().isoformat()}.md"
    body = _render_briefing_markdown(profile, briefing)
    ok = await rag.vault_write(path, body)
    return WritebackResponse(written=ok, path=path)


def _render_briefing_markdown(profile: Profile, b: Briefing) -> str:
    date = b.generated_at[:10]
    lines: list[str] = [
        "---",
        f"date: {date}",
        f"profile: {profile.name}",
        "tags: [career/briefing]",
        "---",
        "",
        f"# Daily Briefing — {date}",
        "",
        f"**Pipeline:** {b.counts.pipeline_open} open · "
        f"**New jobs:** {b.counts.new_jobs} · "
        f"**Deadlines today:** {b.counts.deadlines_today} · "
        f"**Stalled:** {b.counts.stalled_cards} · "
        f"**Follow-ups:** {b.counts.follow_ups}",
        "",
    ]

    lines.append("## New jobs (24h)")
    if b.new_jobs:
        for j in b.new_jobs:
            score = f" · score {j.score:.2f}" if j.score is not None else ""
            link = f"[{j.title} @ {j.company}]({j.url})" if j.url else f"{j.title} @ {j.company}"
            loc = f" — {j.location}" if j.location else ""
            lines.append(f"- {link}{loc}{score}")
    else:
        lines.append("_None._")
    lines.append("")

    lines.append("## Deadlines today")
    if b.deadlines_today:
        for c in b.deadlines_today:
            when = c.deadline[:16].replace("T", " ") if c.deadline else "?"
            link = f"[{c.title} @ {c.company}]({c.url})" if c.url else f"{c.title} @ {c.company}"
            lines.append(f"- **{when}** — {link} _({c.stage})_")
    else:
        lines.append("_None._")
    lines.append("")

    lines.append("## Stalled cards (>7d)")
    if b.stalled_cards:
        for c in b.stalled_cards:
            link = f"[{c.title} @ {c.company}]({c.url})" if c.url else f"{c.title} @ {c.company}"
            lines.append(f"- {link} — {c.days_since_update}d in `{c.stage}`")
    else:
        lines.append("_None._")
    lines.append("")

    lines.append("## Follow-ups owed")
    if b.follow_ups:
        for f in b.follow_ups:
            lines.append(
                f"- **{f.title} @ {f.company}** _({f.stage}, {f.days_in_stage}d)_ — "
                f"{f.suggested_action}"
            )
    else:
        lines.append("_None._")
    lines.append("")

    return "\n".join(lines)


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
