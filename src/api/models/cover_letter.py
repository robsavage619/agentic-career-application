from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, SQLModel


class CoverLetter(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", index=True)
    pipeline_card_id: int | None = Field(default=None, foreign_key="pipelinecard.id")
    content: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
