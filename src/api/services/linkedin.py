from __future__ import annotations

import logging

import httpx

from api.config import settings

log = logging.getLogger(__name__)

AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
API_BASE = "https://api.linkedin.com/v2"


def oauth_url(redirect_uri: str, state: str) -> str:
    params = {
        "response_type": "code",
        "client_id": settings.linkedin_client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": "openid profile email w_member_social",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{AUTH_URL}?{query}"


async def exchange_code(code: str, redirect_uri: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": settings.linkedin_client_id,
                "client_secret": settings.linkedin_client_secret,
            },
        )
        r.raise_for_status()
        return r.json()


async def get_profile(access_token: str) -> dict:
    """Fetch OIDC userinfo + /v2/me for headline and vanity name."""
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=10, headers=headers) as client:
        userinfo: dict = {}
        me: dict = {}

        r = await client.get(f"{API_BASE}/userinfo")
        if r.is_success:
            userinfo = r.json()

        # /v2/me provides headline and vanityName under the profile scope
        r2 = await client.get(
            f"{API_BASE}/me",
            params={"projection": "(id,localizedFirstName,localizedLastName,headline,vanityName)"},
            headers={**headers, "LinkedIn-Version": "202312"},
        )
        if r2.is_success:
            me = r2.json()

    return {
        "sub": userinfo.get("sub", ""),
        "name": userinfo.get("name", ""),
        "picture": userinfo.get("picture", ""),
        "email": userinfo.get("email", ""),
        "headline": me.get("headline", {}).get("localized", {}).get("en_US", "")
                    if isinstance(me.get("headline"), dict)
                    else me.get("headline", ""),
        "vanityName": me.get("vanityName", ""),
    }


async def share_post(access_token: str, urn: str, text: str) -> dict:
    """Post text content to LinkedIn via UGC Posts API."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
    }
    body = {
        "author": urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }
    async with httpx.AsyncClient(timeout=15, headers=headers) as client:
        r = await client.post(f"{API_BASE}/ugcPosts", json=body)
        if r.is_success:
            return r.json()
        log.error("LinkedIn share failed: %s %s", r.status_code, r.text)
        return {"error": r.text}
