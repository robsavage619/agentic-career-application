from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, SQLModel


class LinkedInToken(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", unique=True, index=True)
    access_token: str
    refresh_token: str = ""
    expires_at: datetime | None = None
    linkedin_urn: str = ""  # urn:li:person:xxx
    created_at: datetime = Field(default_factory=datetime.utcnow)


class LinkedInPost(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", index=True)
    content: str
    status: str = "draft"  # "draft" | "scheduled" | "posted"
    scheduled_at: datetime | None = None
    posted_at: datetime | None = None
    linkedin_post_id: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
