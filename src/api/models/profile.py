from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, SQLModel


class Profile(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    accent_color: str = Field(default="#c7ff00")
    avatar_emoji: str = Field(default="bolt")
    rag_tag: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow)
