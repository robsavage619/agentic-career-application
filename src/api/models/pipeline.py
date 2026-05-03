from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlmodel import Field, SQLModel


class PipelineStage(str, Enum):
    DISCOVERED = "DISCOVERED"
    APPLIED = "APPLIED"
    SCREENER = "SCREENER"
    INTERVIEW = "INTERVIEW"
    OFFER = "OFFER"
    CLOSED = "CLOSED"


class PipelineCard(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", index=True)
    job_id: int | None = Field(default=None, foreign_key="job.id")
    stage: PipelineStage = Field(default=PipelineStage.DISCOVERED)
    title: str
    company: str
    url: str = ""
    deadline: datetime | None = None
    notes: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
