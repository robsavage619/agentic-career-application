from __future__ import annotations

import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlmodel import Session, SQLModel, select

from api.agents import run_agent
from api.config import settings
from api.db import get_session
from api.models.linkedin import LinkedInPost, LinkedInToken
from api.models.profile import Profile
from api.services import linkedin as li

router = APIRouter()

REDIRECT_URI = settings.linkedin_redirect_uri


# ── Auth ─────────────────────────────────────────────────────────────────────

@router.get("/auth/{profile_id}")
def start_oauth(profile_id: int) -> RedirectResponse:
    if not settings.linkedin_client_id:
        raise HTTPException(status_code=503, detail="LinkedIn OAuth not configured")
    state = f"{profile_id}:{secrets.token_urlsafe(16)}"
    url = li.oauth_url(REDIRECT_URI, state)
    return RedirectResponse(url)


@router.get("/callback")
async def oauth_callback(
    code: str,
    state: str,
    session: Session = Depends(get_session),
) -> dict:
    profile_id_str = state.split(":")[0]
    if not profile_id_str.isdigit():
        raise HTTPException(status_code=400, detail="Invalid state")
    profile_id = int(profile_id_str)

    token_data = await li.exchange_code(code, REDIRECT_URI)
    access_token = token_data.get("access_token", "")
    expires_in = token_data.get("expires_in", 5184000)

    profile_data = await li.get_profile(access_token)
    urn = profile_data.get("sub", "")

    existing = session.exec(
        select(LinkedInToken).where(LinkedInToken.profile_id == profile_id)
    ).first()

    li_urn = f"urn:li:person:{urn}" if urn else ""
    fields = dict(
        access_token=access_token,
        expires_at=datetime.utcnow() + timedelta(seconds=expires_in),
        linkedin_urn=li_urn,
        li_name=profile_data.get("name", ""),
        li_headline=profile_data.get("headline", ""),
        li_picture_url=profile_data.get("picture", ""),
        li_vanity_name=profile_data.get("vanityName", ""),
    )

    if existing:
        for k, v in fields.items():
            setattr(existing, k, v)
        session.add(existing)
    else:
        session.add(LinkedInToken(profile_id=profile_id, **fields))

    session.commit()
    # Redirect back to the LinkedIn page in the web app
    return RedirectResponse("http://localhost:3001/linkedin")


@router.get("/status/{profile_id}")
def auth_status(profile_id: int, session: Session = Depends(get_session)) -> dict:
    token = session.exec(
        select(LinkedInToken).where(LinkedInToken.profile_id == profile_id)
    ).first()
    if not token:
        return {"connected": False}
    expired = token.expires_at and token.expires_at < datetime.utcnow()
    return {
        "connected": not expired,
        "urn": token.linkedin_urn,
        "name": token.li_name,
        "headline": token.li_headline,
        "picture_url": token.li_picture_url,
        "vanity_name": token.li_vanity_name,
    }


@router.post("/profile/refresh/{profile_id}")
async def refresh_profile(profile_id: int, session: Session = Depends(get_session)) -> dict:
    """Re-fetch LinkedIn profile data and update the cache."""
    token = session.exec(
        select(LinkedInToken).where(LinkedInToken.profile_id == profile_id)
    ).first()
    if not token:
        raise HTTPException(status_code=404, detail="LinkedIn not connected")

    profile_data = await li.get_profile(token.access_token)
    token.li_name = profile_data.get("name", token.li_name)
    token.li_headline = profile_data.get("headline", token.li_headline)
    token.li_picture_url = profile_data.get("picture", token.li_picture_url)
    token.li_vanity_name = profile_data.get("vanityName", token.li_vanity_name)
    session.add(token)
    session.commit()
    return {
        "name": token.li_name,
        "headline": token.li_headline,
        "picture_url": token.li_picture_url,
        "vanity_name": token.li_vanity_name,
    }


# ── Posts ─────────────────────────────────────────────────────────────────────

class PostOut(SQLModel):
    id: int
    profile_id: int
    content: str
    status: str
    scheduled_at: str | None
    posted_at: str | None
    created_at: str


class GeneratePostRequest(SQLModel):
    profile_id: int
    topic: str
    angle: str = ""


class UpdatePostRequest(SQLModel):
    content: str | None = None
    status: str | None = None
    scheduled_at: str | None = None


def _post_out(p: LinkedInPost) -> PostOut:
    return PostOut(
        id=p.id,  # type: ignore[arg-type]
        profile_id=p.profile_id,
        content=p.content,
        status=p.status,
        scheduled_at=p.scheduled_at.isoformat() if p.scheduled_at else None,
        posted_at=p.posted_at.isoformat() if p.posted_at else None,
        created_at=p.created_at.isoformat(),
    )


@router.get("/posts")
def list_posts(profile_id: int, session: Session = Depends(get_session)) -> list[PostOut]:
    rows = session.exec(
        select(LinkedInPost)
        .where(LinkedInPost.profile_id == profile_id)
        .order_by(LinkedInPost.created_at.desc())  # type: ignore[arg-type]
    ).all()
    return [_post_out(p) for p in rows]


@router.post("/posts/generate", status_code=201)
async def generate_post(
    data: GeneratePostRequest,
    session: Session = Depends(get_session),
) -> PostOut:
    profile = session.get(Profile, data.profile_id)
    rag_tag = profile.rag_tag if profile else "rob"

    angle = data.angle or "authentic professional insight"
    final = await run_agent(
        mode="draft_linkedin_post",
        user_prompt=f"Write a LinkedIn post about: {data.topic}\nAngle: {angle}",
        rag_tag=rag_tag,
    )
    content = final.get("output", "")

    post = LinkedInPost(profile_id=data.profile_id, content=content)
    session.add(post)
    session.commit()
    session.refresh(post)
    return _post_out(post)


@router.patch("/posts/{post_id}")
def update_post(
    post_id: int,
    data: UpdatePostRequest,
    session: Session = Depends(get_session),
) -> PostOut:
    post = session.get(LinkedInPost, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Not found")
    if data.content is not None:
        post.content = data.content
    if data.status is not None:
        post.status = data.status
    if data.scheduled_at is not None:
        post.scheduled_at = datetime.fromisoformat(data.scheduled_at)
    session.add(post)
    session.commit()
    session.refresh(post)
    return _post_out(post)


@router.post("/posts/{post_id}/publish")
async def publish_post(post_id: int) -> None:
    raise HTTPException(status_code=503, detail="Publishing is disabled until the app is stable")


@router.delete("/posts/{post_id}", status_code=204)
def delete_post(post_id: int, session: Session = Depends(get_session)) -> None:
    post = session.get(LinkedInPost, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(post)
    session.commit()
