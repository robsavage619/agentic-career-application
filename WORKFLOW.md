# Workflow Rules

Personal-local-only conventions for this repo. Durable; do not change without Rob's say-so.

## Git
- **Push directly to `main`.** No PRs, no feature branches, no review gates.
- Conventional-commit messages still apply: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`, `ci:`.
- Commit before any large refactor or multi-file change so there is always a recovery point.
- Never force-push. Never `reset --hard` without an explicit ask.

## Audience
- **Single-user local app.** Rob's machine, Rob's data.
- **No app-level auth, no multi-tenant, no SaaS path.**
- **LinkedIn OAuth is the only OAuth** — required by LinkedIn's API for posting. Tokens live in `linkedintoken`; only Rob's tokens, only on this machine.

## Vault-first advising
- Obsidian vault (`localhost:27124`) is the canonical research source for every advisory agent call.
- Every agent mode that produces advice (resume rewrite, cover letter, JD analysis, fit scoring, interview prep, LinkedIn drafts, retros) must consult the vault via `vault_search` or `vault_read` at least once.
- This is enforced by test (`tests/test_agent_vault_calls.py`), not by convention alone.
- Read `index.md` first when entering the vault — it carries the table of contents.

## Stack
- Python 3.12, FastAPI, SQLModel, Anthropic SDK, LangGraph (agent layer).
- Next.js 16 / React 19 / Tailwind 4 / Zustand / TanStack Query / dnd-kit.
- SQLite (`career_command_center.db`); Alembic for migrations.
- Tooling: `uv` (packages), `ruff` (lint+format), `pyright` (types).

## Code conventions (mirror `~/.claude/CLAUDE.md`)
- `from __future__ import annotations` at the top of every Python file.
- `X | None` — never `Optional[X]`.
- Google-style docstrings on public/complex functions only.
- f-strings; no `.format()`, no `%`.
- No bare `except:`; specific exceptions.
- No `print()` in library code; use `logging` / `structlog`.
- No comments unless the WHY is non-obvious.

## Pre-commit (local gate, not CI)
Before committing:
```
uv run ruff check src
uv run ruff format --check src
uv run pyright src
uv run pytest -q
```
A `.pre-commit-config.yaml` will wire this into `git commit` automatically.

## Backups
- DB and uploads are gitignored. Run the backup script (Phase 2) to dump `*.db` + `uploads/` + every saved DOCX to a chosen folder before risky migrations.
