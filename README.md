# Career Command Center

Personal, local, agentic job-search assistant. FastAPI + Next.js + SQLite + Anthropic + Obsidian RAG. Single user (Rob).

## What it does
- Tracks the job pipeline as a Kanban board (`DISCOVERED → APPLIED → SCREENER → INTERVIEW → OFFER → CLOSED`).
- Pulls jobs from Adzuna and JSearch.
- Tailors a base DOCX résumé to each JD using Claude, grounded in evidence from an Obsidian vault.
- Drafts cover letters, LinkedIn posts, and (on the roadmap) interview prep + JD fit scoring — all vault-grounded via a LangGraph agent.

## What it isn't
- Not a SaaS, not multi-user, not deployed anywhere. Local only.
- Not authenticated at the app level. The only OAuth is LinkedIn's (their API requires it).

## Stack
| Layer | Tech |
|---|---|
| Backend | Python 3.12, FastAPI, SQLModel, Anthropic SDK, LangGraph |
| Frontend | Next.js 16, React 19, Tailwind 4, Zustand, TanStack Query, dnd-kit |
| Storage | SQLite (`career_command_center.db`) + Alembic |
| RAG | Obsidian Local REST API on `localhost:27124` |
| Tooling | `uv`, `ruff`, `pyright`, `pytest` |

## Run it

Prereqs: Python 3.12+, `uv`, Node 20+, and the Obsidian Local REST API plugin running on port 27124.

```bash
# 1. Install Python deps
uv sync

# 2. Configure secrets
cp env.example .env.local
# fill in: anthropic_api_key, adzuna_*, jsearch_*, linkedin_* (optional), obsidian_api_key

# 3. Apply migrations
uv run alembic upgrade head

# 4. Start the API (port 8000)
uv run uvicorn src.api.main:app --reload --port 8000

# 5. Start the web app (port 3000) — separate terminal
cd src/web
npm install
npm run dev
```

Open http://localhost:3000.

## Layout
```
src/
├── api/                  FastAPI backend
│   ├── agents/           (Phase 1) LangGraph agent layer + vault tools
│   ├── models/           SQLModel ORM tables
│   ├── routers/          HTTP endpoints
│   └── services/         Anthropic client, Obsidian RAG, job APIs, resume engine
└── web/                  Next.js 16 frontend (app router)

alembic/                  DB migrations
tests/                    (Phase 1) pytest suite
```

## Key docs
- `WORKFLOW.md` — git, audience, code, and vault-first conventions for this repo.
- `~/.claude/plans/please-review-this-application-synthetic-newt.md` — current top-to-bottom review and roadmap.

## Status
MVP. The core pipeline + résumé tailoring works. The "agentic" surface is currently single-shot Claude calls; the LangGraph + vault-everywhere refactor is in progress (see plan).
