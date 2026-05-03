from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from api.db import get_session
from api.models.job import Job, SavedJob
from api.services import adzuna, jsearch

router = APIRouter()


class FetchRequest(SQLModel):
    profile_id: int
    keywords: str
    location: str = ""
    country: str = "us"
    remote_ok: bool = False
    salary_min: int | None = None


class SavedJobOut(SQLModel):
    id: int
    profile_id: int
    job_id: int
    score: float | None
    dismissed: bool
    saved_at: str
    job: Job


@router.get("/")
def list_saved(
    profile_id: int,
    dismissed: bool = False,
    session: Session = Depends(get_session),
) -> list[dict]:
    rows = session.exec(
        select(SavedJob, Job)
        .join(Job, SavedJob.job_id == Job.id)  # type: ignore[arg-type]
        .where(SavedJob.profile_id == profile_id)
        .where(SavedJob.dismissed == dismissed)
        .order_by(SavedJob.score.desc())  # type: ignore[union-attr]
    ).all()
    return [
        {
            **sj.model_dump(),
            "job": job.model_dump(),
        }
        for sj, job in rows
    ]


@router.post("/fetch")
async def fetch_jobs(req: FetchRequest, session: Session = Depends(get_session)) -> dict:
    """Fetch from Adzuna + JSearch, upsert into DB, return count of new jobs."""
    az_results, js_results = await _fetch_both(req)
    new_count = _upsert_and_save(az_results + js_results, req.profile_id, session)
    return {"fetched": len(az_results) + len(js_results), "new": new_count}


async def _fetch_both(req: FetchRequest) -> tuple[list[dict], list[dict]]:
    import asyncio
    az, js = await asyncio.gather(
        adzuna.search(
            keywords=req.keywords,
            location=req.location,
            country=req.country,
            salary_min=req.salary_min,
        ),
        jsearch.search(
            query=f"{req.keywords} {req.location}".strip(),
            remote_only=req.remote_ok,
        ),
        return_exceptions=True,
    )
    return (az if isinstance(az, list) else []), (js if isinstance(js, list) else [])


def _upsert_and_save(raw: list[dict], profile_id: int, session: Session) -> int:
    new_count = 0
    for r in raw:
        existing = session.exec(
            select(Job).where(Job.source == r["source"]).where(Job.external_id == r["external_id"])
        ).first()
        if existing:
            job = existing
        else:
            job = Job(**{k: v for k, v in r.items() if k != "posted_at"}, posted_at=r.get("posted_at"))
            session.add(job)
            session.commit()
            session.refresh(job)
            new_count += 1

        already_saved = session.exec(
            select(SavedJob)
            .where(SavedJob.profile_id == profile_id)
            .where(SavedJob.job_id == job.id)
        ).first()
        if not already_saved:
            session.add(SavedJob(profile_id=profile_id, job_id=job.id))
            session.commit()

    return new_count


class DismissRequest(SQLModel):
    reason: str = ""


class DecisionLogEntry(SQLModel):
    saved_job_id: int
    job_id: int
    title: str
    company: str
    decision: str  # "dismissed" | "saved"
    reason: str
    decided_at: str


@router.patch("/{saved_job_id}/dismiss")
def dismiss_job(
    saved_job_id: int,
    data: DismissRequest | None = None,
    session: Session = Depends(get_session),
) -> dict:
    sj = session.get(SavedJob, saved_job_id)
    if not sj:
        raise HTTPException(status_code=404, detail="Not found")
    sj.dismissed = True
    sj.dismiss_reason = (data.reason if data else "").strip()
    sj.decided_at = datetime.utcnow()
    session.add(sj)
    session.commit()
    return {"ok": True}


@router.patch("/{saved_job_id}/save")
def save_job(saved_job_id: int, session: Session = Depends(get_session)) -> dict:
    sj = session.get(SavedJob, saved_job_id)
    if not sj:
        raise HTTPException(status_code=404, detail="Not found")
    sj.dismissed = False
    sj.dismiss_reason = ""
    sj.decided_at = datetime.utcnow()
    session.add(sj)
    session.commit()
    return {"ok": True}


@router.get("/decisions", response_model=list[DecisionLogEntry])
def list_decisions(
    profile_id: int,
    limit: int = 50,
    session: Session = Depends(get_session),
) -> list[DecisionLogEntry]:
    """Application decision log: most recent dismiss/save decisions, newest first.

    Useful as feedback to the agent (preference learning) and as a "why did I
    pass on that?" record for the user.
    """
    rows = session.exec(
        select(SavedJob, Job)
        .join(Job, SavedJob.job_id == Job.id)  # type: ignore[arg-type]
        .where(SavedJob.profile_id == profile_id)
        .where(SavedJob.decided_at.is_not(None))  # type: ignore[union-attr]
        .order_by(SavedJob.decided_at.desc())  # type: ignore[union-attr]
        .limit(limit)
    ).all()
    out: list[DecisionLogEntry] = []
    for sj, job in rows:
        if sj.id is None or job.id is None or sj.decided_at is None:
            continue
        out.append(
            DecisionLogEntry(
                saved_job_id=sj.id,
                job_id=job.id,
                title=job.title,
                company=job.company,
                decision="dismissed" if sj.dismissed else "saved",
                reason=sj.dismiss_reason,
                decided_at=sj.decided_at.isoformat(),
            )
        )
    return out
