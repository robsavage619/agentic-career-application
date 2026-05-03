<div align="center">

# Career Command Center

**A personal, local, agentic job-search command center.**

Vault-grounded résumé tailoring, cover letters, fit scoring, and a daily briefing —
powered by a LangGraph agent over your own Obsidian knowledge base.

`Python 3.12` &nbsp;·&nbsp; `FastAPI` &nbsp;·&nbsp; `Next.js 16` &nbsp;·&nbsp; `LangGraph` &nbsp;·&nbsp; `Anthropic Claude` &nbsp;·&nbsp; `Obsidian RAG`

</div>

---

## Why this exists

A career search produces dozens of half-finished tabs: postings on five sites, a résumé per role,
half-drafted cover letters, a Kanban somewhere, scattered notes about who said what. The signal
is your *own accomplishments* — and they already live in your Obsidian vault.

This app collapses that into one local surface. Every advisory call routes through a single
LangGraph agent that **must** consult your vault before answering. The result: tailored output
that sounds like *you*, not generic LLM filler — because it's grounded in your real evidence.

> **Single user. Local only. Your data never leaves your machine** (other than calls to Claude
> and the job APIs you opt into).

---

## At a glance

```
                    ┌──────────────────────────────────────────────┐
                    │  Next.js 16 frontend  (localhost:3000)       │
                    │  pipeline · feed · resume · letters · panel  │
                    └──────────────────────┬───────────────────────┘
                                           │  REST + SSE
                    ┌──────────────────────┴───────────────────────┐
                    │  FastAPI backend  (localhost:8000)           │
                    │                                              │
                    │   ┌──────────────────────────────────────┐   │
                    │   │  agents/ — LangGraph                 │   │
                    │   │  plan → gather_evidence → act → end  │   │
                    │   │     │                                │   │
                    │   │     └─▶ tools: vault_search,         │   │
                    │   │              vault_read,             │   │
                    │   │              vault_list_recent       │   │
                    │   └──────────────────────────────────────┘   │
                    │   routers/  models/  services/  alembic/     │
                    └────┬───────────────┬──────────────┬──────────┘
                         │               │              │
                  ┌──────▼─────┐  ┌──────▼─────┐  ┌─────▼────────┐
                  │  Anthropic │  │  SQLite    │  │  Obsidian    │
                  │  Claude    │  │  + alembic │  │  REST API    │
                  └────────────┘  └────────────┘  └──────────────┘
```

The agent is the architectural keystone. Every advisory mode (résumé rewrite, cover letter,
LinkedIn draft, JD analysis, fit scoring, interview prep, fit explanation) flows through the
**same graph**, hits the **same vault gate**, and emits the **same tool-call ledger** for the
panel UI.

---

## Features

### Daily-use core

| Feature | Endpoint | What it does |
|---|---|---|
| **Daily Briefing** | `GET /api/dashboard/briefing` | Start-of-day view: new jobs (24h), deadlines today, stalled cards (>7d), stage-aware follow-ups |
| **Briefing → Vault** | `POST /api/dashboard/briefing/writeback` | Renders the briefing as markdown and writes it to `career/briefings/YYYY-MM-DD.md` |
| **JD ↔ Evidence Fit Scoring** | `POST /api/fit/score` | 0-100 score against your vault, with strengths, gaps, and a one-line verdict |
| **Why-this-job Explainer** | `POST /api/fit/explain` | Three bullets why-it-fits, two risks, vault-cited. Cheap enough to run on every card |
| **Application Decision Log** | `GET /api/jobs/decisions` | Every dismiss/save with the *why*. Feedback loop for preference learning |
| **Vault-grounded Résumé Tailoring** | `POST /api/resume/generate` | Format-preserving DOCX rewrite per JD, agent-driven |
| **Vault-grounded Cover Letters** | `POST /api/cover-letter/generate/stream` | Three-paragraph letter, vault evidence, no clichés |
| **Vault-grounded LinkedIn Drafts** | `POST /api/linkedin/posts/generate` | Hook → insight → CTA, ≤1300 chars, max 3 hashtags |
| **Pipeline Kanban** | `GET/PATCH /api/pipeline` | `DISCOVERED → APPLIED → SCREENER → INTERVIEW → OFFER → CLOSED` |
| **Job Discovery** | `POST /api/jobs/fetch` | Pulls Adzuna + JSearch into your saved-job feed |
| **LinkedIn Posting (OAuth)** | `POST /api/linkedin/posts/{id}/publish` | The one OAuth in the app — required by LinkedIn's API |

### Agent modes

The LangGraph agent supports seven advisory modes, all defined in `src/api/agents/graph.py`:

```
rewrite_resume        Tailor numbered bullets to a JD, vault-grounded.
draft_cover_letter    Three-paragraph cover letter, evidence + ask.
draft_linkedin_post   Authentic LinkedIn voice, no corporate gloss.
analyze_jd            Extract must-haves, nice-to-haves, signals, themes.
score_match           0-100 fit score with strengths, gaps, verdict.
interview_prep        Likely questions + STAR answers from vault.
explain_fit           "Why this job?" — 3 bullets fit, 2 risks.
```

Each mode has its own persona, model choice (Sonnet/Haiku), max-tokens, and vault-query plan.

---

## The vault-everywhere principle

> **Every advisory agent call must consult the Obsidian vault at least once before producing output.**

This isn't a guideline. It's enforced by `tests/test_agent_vault_calls.py`, which is parametrized
over every `AgentMode` and asserts `vault_search` was invoked. Add a new mode without wiring the
vault and the build fails.

The reason: an LLM with no evidence drifts toward generic platitudes; an LLM grounded in your
actual accomplishments writes like you do. Your vault is the difference.

---

## Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.12 · FastAPI · SQLModel · Anthropic SDK · LangGraph 1.x |
| **Frontend** | Next.js 16 · React 19 · TailwindCSS 4 · Zustand · TanStack Query · dnd-kit |
| **Storage** | SQLite (`career_command_center.db`) · Alembic migrations |
| **Knowledge base** | Obsidian Local REST API on `localhost:27124` |
| **LLM** | Claude Sonnet 4.6 (advisory) · Haiku 4.5 (extraction/explanation) |
| **Tooling** | `uv` (packages) · `ruff` (lint+format) · `pyright` (types, basic) · `pytest` (tests) |

---

## Quickstart

**Prerequisites:** Python 3.12+, `uv`, Node 20+, an Obsidian vault with the Local REST API
plugin running on port 27124, and an Anthropic API key.

```bash
# 1. Install Python dependencies
uv sync

# 2. Configure secrets
cp env.example .env.local
# Fill in:
#   ANTHROPIC_API_KEY        — required
#   OBSIDIAN_API_KEY         — required (from the Obsidian plugin settings)
#   ADZUNA_APP_ID/KEY        — optional, for job discovery
#   JSEARCH_RAPIDAPI_KEY     — optional, for job discovery
#   LINKEDIN_CLIENT_ID/SECRET— optional, for LinkedIn posting

# 3. Apply database migrations
uv run alembic upgrade head

# 4. Start the API (port 8000)
uv run uvicorn src.api.main:app --reload --port 8000

# 5. In a second terminal, start the web app (port 3000)
cd src/web
npm install
npm run dev
```

Open <http://localhost:3000>. Browse to `/dashboard`, `/feed`, `/pipeline`, `/resume`,
`/letters`, `/linkedin`, or `/panel`.

---

## Project structure

```
agentic-career-application/
│
├── src/
│   ├── api/                          FastAPI backend
│   │   ├── agents/                   LangGraph agent layer
│   │   │   ├── graph.py                StateGraph + per-mode personas/models
│   │   │   ├── state.py                AgentState TypedDict, AgentMode literal
│   │   │   └── tools.py                vault_search / vault_read / vault_list_recent
│   │   ├── models/                   SQLModel ORM tables
│   │   ├── routers/                  HTTP endpoints (8 routers)
│   │   │   ├── dashboard.py            Daily Briefing
│   │   │   ├── fit.py                  JD↔evidence fit scoring
│   │   │   ├── jobs.py                 Discovery + decision log
│   │   │   ├── pipeline.py             Kanban
│   │   │   ├── resume.py / cover_letter.py / linkedin.py / panel.py / profiles.py
│   │   ├── services/                 Anthropic client, Obsidian RAG, job APIs, DOCX engine
│   │   ├── config.py                 pydantic-settings from .env.local
│   │   ├── db.py                     SQLModel engine + session
│   │   └── main.py                   FastAPI app + router wiring
│   │
│   └── web/                          Next.js 16 frontend (app router)
│       ├── app/(app)/                Pages: dashboard, feed, pipeline, resume, letters, …
│       ├── components/ui/            Card, Badge, StatCard, ProfileIcons
│       └── ...
│
├── alembic/versions/                 Database migrations
├── tests/                            pytest suite (24 tests)
│   ├── test_agent_vault_calls.py       Vault-everywhere enforcement (parametrized)
│   ├── test_briefing.py                Daily Briefing buckets
│   ├── test_decision_log.py            Dismiss/save with reason + history
│   ├── test_fit.py                     Fit scoring + score parsing
│   └── test_health.py                  App smoke
│
├── pyproject.toml                    uv + ruff + pyright + pytest config
├── env.example                       Secret template (gitignored .env.local)
├── README.md                         You are here
├── CHANGELOG.md                      Release log
└── WORKFLOW.md                       Durable conventions
```

---

## Development

### Day-to-day

```bash
# Lint + format
uv run ruff check src tests
uv run ruff format src tests

# Type-check (basic mode)
uv run pyright src tests

# Tests
uv run pytest -q
```

### Database changes

```bash
# Create a new migration after editing a model
uv run alembic revision --autogenerate -m "describe the change"

# Apply
uv run alembic upgrade head

# Roll back one
uv run alembic downgrade -1
```

### Adding an agent mode

1. Add the mode literal to `AgentMode` in `src/api/agents/state.py`.
2. Add an entry to `_PERSONAS`, `_MODEL_FOR`, `_MAX_TOKENS_FOR`, and `_evidence_queries` in
   `src/api/agents/graph.py`.
3. Add the mode to `ALL_MODES` in `tests/test_agent_vault_calls.py`.
4. Wire a caller (router) that invokes `run_agent(mode=...)`.

The vault-everywhere test will pass automatically once the persona is in place — no
extra wiring needed.

---

## Conventions

This is a personal local app, so:

- **Push directly to `main`.** No PRs, no feature branches. Conventional-commit messages
  (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`, `ci:`).
- **No app-level auth.** Single-user local. The only OAuth is LinkedIn's (their API
  requires it).
- **Vault-first advising.** Enforced in code by `tests/test_agent_vault_calls.py`.
- **Python style:** `from __future__ import annotations`, `X | None` (never `Optional[X]`),
  Google-style docstrings on public functions only, no `print()` in library code, no
  comments unless the WHY is non-obvious.

See [`WORKFLOW.md`](WORKFLOW.md) for the full ruleset.

---

## Roadmap

A full roadmap and feature catalog lives in
`~/.claude/plans/please-review-this-application-synthetic-newt.md`. Highlights:

**Tier 1 — daily-use core** (4 of 4 shipped)

- [x] Daily Briefing
- [x] JD ↔ Evidence Fit Scoring
- [x] Application Decision Log
- [x] Vault Writeback — briefing renders to `career/briefings/YYYY-MM-DD.md` in your vault

**Tier 2 — high-leverage rituals**

- [x] "Why this job?" inline explainer on feed cards (`POST /api/fit/explain`)
- [ ] Interview Prep mode wired to a UI flow
- [ ] Résumé Diff View (per-card DOCX bullet diff)
- [ ] Compensation Floor & Tracker

**Tier 3 — connective tissue**

- [ ] Lightweight Networking CRM
- [ ] Deadline & Follow-up Engine UI
- [ ] Outcome Retrospectives (vault writeback)
- [ ] Stack-aware JD filtering (FinOps / Python / Databricks / agentic)

**Tier 4 — ambition**

- [ ] Weekly digest to vault
- [ ] Token-cost ledger per profile per job
- [ ] LinkedIn polish (refresh tokens, scheduler, post templates)
- [ ] Agent-streaming + live agent-trace panel UI

---

## Health

|  |  |
|---|---|
| Tests | **31 passing** · 1 vault-enforcement parametrized over 7 modes |
| Lint | **clean** (`ruff check src tests`) |
| Types | **basic mode**, 2 known pre-existing scaffold warnings, zero regressions |
| Lines of code | ~3,000 Python + ~700 TypeScript |
| Migrations | 2 (initial schema · savedjob decision log) |

---

## License

Private. Personal use only. Do not redistribute.
