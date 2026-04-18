# Career Command Center — Planning Document

## Vision

A premium, intelligent web application that serves as a professional's single source of
truth for their career presence. Users upload their resume, connect their LinkedIn profile,
and receive a continuously-updated dashboard that diagnoses the health of their professional
brand, surfaces opportunities, and gives them AI-powered tools to act on every insight
immediately.

The core loop: **ingest → analyze → recommend → act → re-analyze.**

---

## Problem Statement

Professionals maintain their career materials reactively — updating a resume only when job
hunting, ignoring LinkedIn until they need it, and having no systematic way to know if
they're keeping pace with their industry. This application flips that model by making
proactive career management easy, intelligent, and continuous.

---

## Core Features

### 1. Document & Profile Ingestion
- **Resume upload** — PDF or DOCX parsing with structured extraction of roles, skills,
  education, certifications, dates, and achievements
- **LinkedIn import** — URL-based profile ingestion (via user-provided export or browser
  extension scrape) that maps the same structured schema as the resume
- **Unified professional profile** — a canonical data model that merges both sources,
  deduplicates, and flags discrepancies between resume and LinkedIn

### 2. Professional Health Dashboard
The main screen. A live scorecard and action feed covering:
- **Overall Career Health Score** (0–100) with sub-scores per dimension
- **Profile Completeness** — missing sections, thin descriptions, undated roles
- **Skills Currency** — how recently-in-demand each listed skill is against live job postings
- **Competitive Positioning** — how the profile compares to peers in the same role/industry
- **Content Quality** — passive language, weak action verbs, vague impact statements
- **Recency Signal** — how recent the last activity, certification, or role is

### 3. Job Match Feed
- AI-ranked list of open roles the user is currently qualified for, with match percentage
- Breakdown of why each job was matched (aligned skills, title proximity, location)
- Gap analysis per job: "You're missing X — here's how to address it"
- One-click apply prep: tailored resume bullet suggestions and cover letter draft for the role
- Configurable filters: remote/hybrid/on-site, seniority, location, salary band

### 4. Certification & Learning Recommendations
- Ranked list of certifications that would most improve the user's market value
- Prioritized by: demand in target job postings, time-to-complete, cost, and employer recognition
- Links to official certification bodies and estimated study timelines
- Tracks certifications the user has already earned and sets renewal reminders

### 5. Skills Gap & Improvement Engine
- Side-by-side view: skills the user has vs. skills their target roles require
- Trending skills in the user's industry the user doesn't yet list
- Concrete improvement tasks with estimated effort levels:
  - Add a certification
  - Contribute to an open-source project
  - Write a technical article
  - Take an online course
- Progress tracker for active improvement tasks

### 6. Resume & LinkedIn Editor
- Side-by-side editor showing current content alongside AI-generated rewrites
- AI actions available per-section:
  - "Strengthen this bullet" — adds metrics, active verbs, impact framing
  - "Make this ATS-optimized" — aligns language to high-frequency keywords in target postings
  - "Tailor for this role" — rewrites a section for a specific job description
  - "Expand" / "Condense" — adjusts length
- Export to clean PDF or copy-to-clipboard for LinkedIn
- Version history with diff view so the user can always roll back

### 7. Industry Intelligence Feed
- Curated, AI-summarized feed of trends in the user's industry/role
- Surfaces: emerging technologies, shifting skill demands, salary movement, notable layoffs
  or hiring surges, regulatory changes relevant to the field
- Personalized to the user's seniority level and sub-specialty
- Weekly digest email option

### 8. Career Trajectory Planner
- Input a target role (e.g., "VP of Engineering in 3 years")
- AI generates a step-by-step roadmap: roles to pursue, skills to build, certifications to earn
- Visual timeline with milestones and dependency graph
- Progress tracking against the roadmap

### 9. Interview Preparation Module
- Auto-generates a bank of likely interview questions based on the user's target roles
- Behavioral questions mapped to the user's own resume experience (STAR-format prompts)
- Technical question sets aligned to the skill gaps identified in the profile
- Mock interview mode: user answers, AI evaluates and provides structured feedback

---

## Agentic Architecture

The application is powered by a multi-agent system built on the Claude API. Agents run
asynchronously, report results back to the database, and surface findings through the
dashboard in real-time.

### Agent Roster

| Agent | Trigger | Responsibility |
|---|---|---|
| **Ingestion Agent** | File upload or profile URL submission | Parse raw resume/LinkedIn data into structured profile schema |
| **Health Scoring Agent** | Profile updated | Compute all sub-scores and produce ranked action items |
| **Job Scan Agent** | Scheduled (daily) + on-demand | Query job boards for relevant postings, rank by match, extract requirements |
| **Certification Advisor Agent** | Profile updated or on-demand | Research in-demand certifications for user's role/industry, rank by ROI |
| **Skills Gap Agent** | Job match selected or profile updated | Compute exact delta between user's profile and a target role's requirements |
| **Content Generation Agent** | User requests rewrite | Produce resume/LinkedIn rewrites, cover letters, and summaries on demand |
| **Industry Intelligence Agent** | Scheduled (daily) | Scan industry news, summarize trends, tag to user's domain |
| **Career Planner Agent** | Target role submitted | Build multi-step roadmap from current state to target state |
| **Interview Prep Agent** | Target role or interview date set | Generate question bank and evaluate practice answers |

### Agent Tool Use

Each agent has access to a curated toolset:

- **web_search** — live job board and news queries (via Brave Search or Serper API)
- **extract_structured_data** — parse PDFs and HTML into typed schemas
- **read_profile** — fetch the user's current canonical profile from the database
- **write_profile** — update specific fields in the user's profile
- **write_recommendation** — post a scored recommendation card to the dashboard
- **generate_document** — produce formatted resume sections or full PDFs
- **query_job_postings** — search a job postings cache/index
- **calculate_score** — run scoring functions against profile dimensions

### Orchestration Model

- A top-level **Orchestrator** receives events (profile upload, scheduled trigger, user
  action) and decides which agents to dispatch and in what order
- Agents run as independent async tasks; long-running agents stream progress back to the
  frontend via Server-Sent Events (SSE)
- Agent outputs are written to the database; the dashboard reactively re-renders on update
- The user can interact with any agent directly via a natural-language chat interface
  ("Show me jobs at Series B startups in Berlin" / "Rewrite my summary for a CTO role")

---

## Data Model (Core Entities)

```
User
  id, email, name, created_at

ProfessionalProfile
  id, user_id
  headline, summary, location, target_roles[]
  raw_resume_text, raw_linkedin_text
  last_ingested_at

Experience[]
  profile_id, company, title, start_date, end_date
  description, skills_mentioned[], achievements[]

Education[]
  profile_id, institution, degree, field, graduation_year

Certification[]
  profile_id, name, issuer, earned_date, expiry_date, credential_url

Skill[]
  profile_id, name, proficiency, last_used_year, source (resume|linkedin|inferred)

HealthScore
  profile_id, computed_at, overall_score
  completeness_score, currency_score, quality_score,
  positioning_score, recency_score, dimension_breakdown{}

JobMatch
  profile_id, job_id, match_score, match_reasons[]
  gap_skills[], fetched_at

JobPosting
  id, title, company, location, remote, seniority
  required_skills[], description, url, posted_at

Recommendation
  id, profile_id, type (job|cert|skill|content|trend)
  priority, title, body, action_url, dismissed_at

ResumeVersion
  profile_id, version_number, content_json, created_at, label

AgentRun
  id, user_id, agent_name, status, started_at, completed_at
  input_summary, output_summary, error

IndustryInsight
  id, user_id, title, summary, source_url, published_at, tags[]
```

---

## Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router) with TypeScript
- **UI**: Tailwind CSS + shadcn/ui component library
- **Charts & Visualization**: Recharts for score trends and skill matrices
- **Real-time**: Server-Sent Events for agent progress streaming
- **State**: Zustand for client state, TanStack Query for server state
- **Forms**: React Hook Form + Zod validation

### Backend
- **API**: FastAPI (Python) — async, type-safe, fast
- **AI**: Anthropic Claude API (`claude-sonnet-4-6` for agents, `claude-opus-4-7` for
  complex reasoning tasks like career planning)
- **Task Queue**: Celery + Redis for async agent dispatch and scheduling
- **Search**: Brave Search API or Serper for live web queries
- **PDF Parsing**: PyMuPDF (fitz) for resume extraction
- **Auth**: Clerk (managed) or Auth.js

### Data
- **Database**: PostgreSQL (primary), Redis (cache + task broker)
- **ORM**: SQLAlchemy (async) with Alembic for migrations
- **File Storage**: AWS S3 (or compatible — Cloudflare R2) for uploaded resumes

### Infrastructure
- **Containerization**: Docker + Docker Compose for local dev
- **Hosting**: Vercel (frontend) + Railway or Render (FastAPI + Celery + Postgres + Redis)
- **CI/CD**: GitHub Actions — lint, type-check, test on PR; deploy on merge to main
- **Monitoring**: Sentry for error tracking, Posthog for product analytics

---

## API Surface (Key Endpoints)

```
POST   /api/profile/resume          Upload and parse resume file
POST   /api/profile/linkedin        Ingest LinkedIn profile URL or export
GET    /api/profile                 Fetch canonical unified profile
PATCH  /api/profile                 Update profile fields

GET    /api/dashboard               Fetch health scores + top recommendations
GET    /api/dashboard/score-history Score trend over time

GET    /api/jobs                    Paginated job match feed
GET    /api/jobs/{id}               Single job detail with full gap analysis
POST   /api/jobs/{id}/prep          Trigger content generation agent for a role

GET    /api/certifications          Recommended certifications list
GET    /api/skills/gap              Full skills gap report

GET    /api/resume/versions         Resume version history
POST   /api/resume/rewrite          Trigger content generation for a section
POST   /api/resume/export           Generate and return polished PDF

GET    /api/insights                Industry intelligence feed
POST   /api/plan                    Submit target role, receive career roadmap

GET    /api/agents/runs             List recent agent runs + status
GET    /api/agents/runs/{id}/stream SSE stream for live agent progress

POST   /api/chat                    Freeform natural-language query to agent system
```

---

## UI/UX Design Principles

- **Clarity over density** — the dashboard should feel like a premium product, not a
  spreadsheet. Use cards, scores with color signals (green/amber/red), and progressive
  disclosure.
- **Action-first** — every insight must have a visible action button. No orphaned data.
- **Streaming feedback** — when an agent is running, show it. Animated progress,
  live-updating cards, no full-page spinners.
- **Dark mode first** — professional, polished look that works in dark and light.
- **Mobile-responsive** — the feed and individual recommendations must be usable on
  mobile; the editor and planner can be desktop-first.

### Page Map

```
/ (Landing)
/onboarding              Step-by-step: upload resume → connect LinkedIn → set target role
/dashboard               Main health score hub + action feed
/dashboard/jobs          Job match feed with filters
/dashboard/jobs/[id]     Single job with gap analysis + one-click prep
/dashboard/certifications  Cert recommendations with status tracking
/dashboard/skills        Full skills matrix and gap view
/dashboard/resume        Side-by-side resume editor with AI tools
/dashboard/insights      Industry intelligence feed
/dashboard/plan          Career trajectory planner
/dashboard/interview     Interview prep module
/dashboard/chat          Direct agent chat interface
/settings                Profile, notifications, integrations
```

---

## Implementation Phases

### Phase 1 — Foundation (Weeks 1–3)
- Project scaffolding: Next.js frontend, FastAPI backend, Docker Compose
- Auth flow (Clerk)
- Resume upload + parsing (PyMuPDF + Ingestion Agent)
- LinkedIn manual import (user pastes text or uploads LinkedIn PDF export)
- Unified profile data model and CRUD API
- Basic health scoring (completeness + content quality dimensions)
- Dashboard skeleton with static score cards

### Phase 2 — Job Intelligence (Weeks 4–5)
- Job Scan Agent with Brave Search integration
- Job match feed with scoring and gap analysis
- Skills Gap Agent
- Certification Advisor Agent
- Recommendation card system on dashboard

### Phase 3 — Content Tools (Weeks 6–7)
- Resume editor UI (side-by-side)
- Content Generation Agent (rewrite, tailor, expand, condense)
- Resume version history
- PDF export
- Cover letter generation

### Phase 4 — Intelligence & Planning (Weeks 8–9)
- Industry Intelligence Agent + insights feed
- Career Trajectory Planner
- Interview Prep Module
- Score trend tracking and history charts

### Phase 5 — Agentic Chat & Polish (Weeks 10–11)
- Natural-language chat interface wired to agent orchestrator
- Agent run history and status streaming
- Onboarding flow
- Mobile responsiveness pass
- Error handling, empty states, loading skeletons

### Phase 6 — Growth & Reliability (Week 12+)
- Weekly digest email (Resend)
- Notification system (in-app + email)
- Performance audit and caching strategy
- End-to-end test suite
- Public landing page

---

## Open Questions / Decisions Needed

1. **LinkedIn ingestion method** — Direct scraping is fragile and against LinkedIn TOS.
   Options: (a) user downloads their own LinkedIn data export ZIP and uploads it,
   (b) user pastes their profile URL and we use a compliant scraping service,
   (c) user manually pastes content. Recommend starting with (a) + (c) for v1.

2. **Job board data source** — Options: Indeed API (limited), LinkedIn Jobs (TOS issues),
   Adzuna API (free tier available), Brave Search web results. Recommend Adzuna + web
   search fallback.

3. **Hosting cost model** — Celery workers + daily agent runs for N users will drive
   compute costs. Consider batching low-priority scans during off-peak hours and adding
   a usage-based tier.

4. **Multi-user rate limiting** — Claude API calls per agent run need careful budgeting.
   Cache job scan results per role/location for 24 hours. Use `claude-haiku-4-5` for
   lightweight tasks (scoring, extraction) and `claude-sonnet-4-6` for generation.

5. **Privacy & data handling** — Resumes contain PII. Need clear data retention policy,
   encryption at rest, and the ability to fully delete all user data on request (GDPR/CCPA).
