from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, SQLModel


class InterviewPrep(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", index=True)
    pipeline_card_id: int = Field(foreign_key="pipelinecard.id", index=True)
    job_description: str = ""
    content: str = ""  # markdown — questions + STAR answers
    evidence_json: str = ""  # cached vault evidence used at generation
    vault_path: str = ""  # writeback path, set on vault save
    created_at: datetime = Field(default_factory=datetime.utcnow)
