from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, SQLModel


class PanelSession(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", index=True)
    document_type: str  # "resume" | "cover_letter" | "linkedin_post" | "strategy" | "plan"
    document_snapshot: str
    reviews_json: str = "{}"
    created_at: datetime = Field(default_factory=datetime.utcnow)
