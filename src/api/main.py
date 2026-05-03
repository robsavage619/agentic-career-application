from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.db import init_db
from api.routers import (
    cover_letter,
    dashboard,
    fit,
    interview_prep,
    jobs,
    linkedin,
    linkedin_metrics,
    panel,
    pipeline,
    profiles,
    resume,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Career Command Center", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiles.router, prefix="/api/profiles", tags=["profiles"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(pipeline.router, prefix="/api/pipeline", tags=["pipeline"])
app.include_router(resume.router, prefix="/api/resume", tags=["resume"])
app.include_router(cover_letter.router, prefix="/api/cover-letter", tags=["cover-letter"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(linkedin.router, prefix="/api/linkedin", tags=["linkedin"])
app.include_router(linkedin_metrics.router, prefix="/api/linkedin", tags=["linkedin"])
app.include_router(panel.router, prefix="/api/panel", tags=["panel"])
app.include_router(fit.router, prefix="/api/fit", tags=["fit"])
app.include_router(interview_prep.router, prefix="/api/interview-prep", tags=["interview-prep"])


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
