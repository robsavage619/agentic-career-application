from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, SQLModel


class Job(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    source: str  # "adzuna" | "jsearch"
    external_id: str = Field(index=True)
    title: str
    company: str
    location: str = ""
    salary_min: float | None = None
    salary_max: float | None = None
    description: str = ""
    url: str = ""
    posted_at: datetime | None = None
    fetched_at: datetime = Field(default_factory=datetime.utcnow)


class SavedJob(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", index=True)
    job_id: int = Field(foreign_key="job.id")
    score: float | None = None
    dismissed: bool = False
    dismiss_reason: str = ""  # one-line "why" captured when dismissed; feeds preference learning
    decided_at: datetime | None = None  # when dismiss/save was last toggled
    saved_at: datetime = Field(default_factory=datetime.utcnow)
