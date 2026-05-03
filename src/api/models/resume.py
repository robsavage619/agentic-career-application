from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, SQLModel


class BaseResume(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", index=True)
    name: str
    docx_bytes: bytes
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)


class ResumeVersion(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    base_resume_id: int = Field(foreign_key="baseresume.id", index=True)
    pipeline_card_id: int | None = Field(default=None, foreign_key="pipelinecard.id")
    docx_bytes: bytes
    jd_snapshot: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
