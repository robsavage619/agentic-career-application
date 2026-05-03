"""Smoke test for the FastAPI app — proves wiring is intact."""
from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app


def test_app_starts() -> None:
    with TestClient(app) as client:
        r = client.get("/openapi.json")
        assert r.status_code == 200
        assert r.json()["info"]["title"]
