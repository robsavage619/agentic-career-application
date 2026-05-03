from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, SQLModel


class LinkedInSnapshot(SQLModel, table=True):
    """Daily-ish snapshot of profile metrics. Append-only for trend tracking."""

    id: int | None = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", index=True)
    follower_count: int = 0
    connection_count: int = 0
    profile_views_7d: int = 0
    search_appearances_7d: int = 0
    captured_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class LinkedInConnection(SQLModel, table=True):
    """A row per connection. Re-synced periodically — overwrites by (profile_id, urn)."""

    id: int | None = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", index=True)
    urn: str = Field(index=True)  # urn:li:fs_miniProfile:xxx
    public_id: str = ""  # vanityName slug
    full_name: str = ""
    headline: str = ""
    current_company: str = ""
    current_title: str = ""
    location: str = ""
    industry: str = ""
    picture_url: str = ""
    connected_at: datetime | None = None
    last_synced_at: datetime = Field(default_factory=datetime.utcnow)
