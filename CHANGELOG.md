# Changelog

All notable changes to **Career Command Center** are recorded here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres loosely to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Because the app is
single-user and local-only, version bumps mark milestones rather than public releases.

---

## [Unreleased]

### Added
- **Vault writeback** — `services/rag.vault_write(path, content)` PUTs markdown notes to the
  Obsidian Local REST API. Path-traversal protected, degrades gracefully when offline.
- **`POST /api/dashboard/briefing/writeback`** — renders today's briefing as a frontmatter-
  tagged markdown note and writes to `career/briefings/YYYY-MM-DD.md` in the vault.
  Same-day calls overwrite (daily idempotent).
- **`POST /api/fit/explain`** — "Why this job?" inline explainer backed by the `explain_fit`
  agent mode. Three bullets why-it-fits + two risks, vault-cited. Cheap enough to run on
  every feed card.

### Internal
- Extracted `_build_briefing()` in `dashboard.py` so the markdown renderer and the GET
  endpoint share one source of truth.
- Extracted `_dedupe_evidence()` in `fit.py` shared between `/score` and `/explain`.

### Planned next
- Frontend integration of `/api/fit/score` and `/api/fit/explain` (score chip + evidence cards)
- Agent-streaming so cover-letter SSE returns to token-by-token UX
- Live agent-trace panel UI surfacing `state.tool_calls` and `state.evidence`
- Decision-log writeback + outcome retrospectives to vault

---

## [0.2.0] — 2026-05-02 — Agentic refactor + Tier 1 features

The app stops calling itself "agentic" and becomes it. A LangGraph agent layer replaces the
single-shot Claude calls, every advisory mode is gated on consulting the Obsidian vault, and the
first three Tier-1 daily-use features land.

### Added

- **LangGraph agent layer** (`src/api/agents/`)
  - `graph.py` — linear `StateGraph`: `plan → gather_evidence → act → finalize`. Per-mode
    personas, model choices (Sonnet/Haiku), max-tokens, and vault-query plans.
  - `state.py` — `AgentState` TypedDict and `AgentMode` literal covering seven advisory modes
    (`rewrite_resume`, `draft_cover_letter`, `draft_linkedin_post`, `analyze_jd`, `score_match`,
    `interview_prep`, `explain_fit`).
  - `tools.py` — vault tool registry (`vault_search`, `vault_read`, `vault_list_recent`) plus
    Anthropic tool-use schemas ready for a future tool-using node.
- **Vault tool interface** in `services/rag.py` — promoted from a single `search()` helper to
  the canonical `vault_search` / `vault_read` / `vault_list_recent` surface. Legacy `search()`
  and `get_note()` retained as backwards-compat shims.
- **`POST /api/fit/score`** — JD ↔ evidence fit-scoring endpoint backed by the `score_match`
  agent mode. Returns `{score, verdict, output, evidence}` with score parsed from
  `Score: NN/100` in the agent output.
- **`GET /api/dashboard/briefing`** — Daily Briefing endpoint aggregating new jobs (last 24h),
  deadlines today, stalled cards (>7 days no movement), stage-aware follow-ups (APPLIED >7d,
  SCREENER >4d, INTERVIEW >3d) with suggested actions, plus roll-up counts.
- **Application Decision Log**
  - `savedjob.dismiss_reason TEXT` and `savedjob.decided_at DATETIME` columns
    (Alembic migration `a1b2c3d4e5f6`).
  - `PATCH /api/jobs/{id}/dismiss` accepts a `{"reason": "..."}` body.
  - `PATCH /api/jobs/{id}/save` clears the reason and re-stamps the decision time.
  - `GET /api/jobs/decisions?profile_id=N` returns recent decisions newest-first.
- **Test suite** — 24 tests covering vault-everywhere enforcement (parametrized over every
  agent mode), Daily Briefing buckets, fit-score parsing, decision-log behaviors, and FastAPI
  app smoke. `pytest` configured with `asyncio_mode=auto` and `pythonpath=["src"]`.
- **`obsidian_api_key` setting** in `config.py` and `env.example`.
- **`.claude/settings.json`** — project-scoped permission rule allowing `Bash(git ...)` so the
  push-to-main workflow doesn't prompt on every commit.
- **Documentation**
  - `WORKFLOW.md` codifying push-to-main, vault-first, and code-style rules.
  - This `CHANGELOG.md`.
  - Comprehensive `README.md` with architecture diagram, feature matrix, quickstart, project
    structure, and roadmap.

### Changed

- `services/resume_engine.rewrite` now delegates to `run_agent(mode="rewrite_resume", ...)`.
  Persona and RAG construction moved out of the service into the agent layer.
- Cover-letter generation (`POST /api/cover-letter/generate/stream`) routed through
  `run_agent(mode="draft_cover_letter", ...)`. SSE shape preserved (frontend client unchanged)
  but emits a single chunk after the agent finishes.
- LinkedIn post generation (`POST /api/linkedin/posts/generate`) routed through
  `run_agent(mode="draft_linkedin_post", ...)`.
- `PipelineStage` migrated from `(str, Enum)` to `StrEnum` (Python 3.12+ idiomatic form).

### Fixed

- **Vault auth bug in `services/rag.py`** — the `Authorization: Bearer ...` header was passing
  `settings.obsidian_api_port` (the integer `27124`) instead of the API key. Vault calls were
  silently auth-failing against the Obsidian Local REST API. Now uses a real `obsidian_api_key`.

### Internal

- Added `langgraph >= 0.2.0` dependency.
- Ruff configured to recognize FastAPI's `Depends`, `Query`, `File`, `Form` as immutable
  defaults, eliminating ~36 false-positive `B008` warnings.
- Cleaned up trivial `F401` (unused imports) and `F541` (extraneous f-prefix) in routers
  surfaced by Ruff after the agent refactor.

### Migrations to run

```bash
uv run alembic upgrade head
```

Adds `dismiss_reason` and `decided_at` columns on `savedjob`.

---

## [0.1.0] — 2026-04-20 — Initial scaffold

The MVP: a working FastAPI + Next.js + SQLite + Anthropic SDK stack covering the core
job-search workflow, committed as a recovery baseline.

### Added

- **FastAPI backend** (`src/api/`) — 8 routers, 5 services, 6 SQLModel tables, 1 Alembic
  migration covering the initial schema (`profile`, `job`, `savedjob`, `pipelinecard`,
  `baseresume`, `resumeversion`, `coverletter`, `linkedintoken`, `linkedinpost`, `panelsession`).
- **Next.js 16 frontend** (`src/web/`) — React 19, Tailwind 4, Zustand, TanStack Query, dnd-kit.
  Pages for dashboard, feed, pipeline, résumé, cover letters, LinkedIn, panel.
- **DOCX résumé rewrite** preserving original formatting (`services/resume_engine.py`).
- **Anthropic streaming + prompt caching** (`services/anthropic.py`).
- **Obsidian vault search** (`services/rag.py`).
- **Adzuna + JSearch job ingestion** (`services/adzuna.py`, `services/jsearch.py`).
- **LinkedIn OAuth** (start, callback, status), post generation, publishing via UGC Posts API.
- **Project tooling** — `pyproject.toml` with ruff, pyright, uv, pytest configured. Python 3.12
  pinned. Single-file SQLite DB.

### Internal

- Initial `WORKFLOW.md` and promoted `README.md` documenting push-to-main and vault-first
  conventions.

---

## Git history

```
fb55fec  feat(decisions): application decision log on SavedJob
e748ef9  feat(dashboard): Daily Briefing — first daily-use Tier 1 feature
bf6c0d4  feat(fit): JD↔evidence fit-scoring endpoint
08c7d65  feat(agents): route cover letter + linkedin generation through run_agent
3cd9af4  test: vault-everywhere enforcement + smoke; lint cleanup
dcc37f8  feat(agents): LangGraph agent layer with vault-everywhere gate
424e843  fix(rag): use obsidian_api_key for auth; promote to vault tool interface
4cfe4e9  docs: add WORKFLOW.md, real README, and push-to-main permission
1784a4f  chore: initial application scaffold
70e7446  Initial commit
```
