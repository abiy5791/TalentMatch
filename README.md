# TalentMatch — Recruitment & Talent Matching Platform

A full-stack recruitment management system: a public careers board anyone can apply
through, curated candidate-job matching, dual-track pipeline management, direct talent
dispatch, placement tracking and gap analytics.

Implements the MVP scope of `recruitment_platform_implementation_plan.md` as a single
NestJS API plus a React admin console, with the plan's service boundaries kept as
modules so they can be extracted later.

## Architecture

```
┌──────────────────┐      ┌───────────────────────┐      ┌─────────────────┐
│  React Frontend  │─────▶│  NestJS API           │─────▶│  PostgreSQL 16  │
│  Vite + TS       │ /api │  REST + Swagger       │      │  (TypeORM)      │
│  localhost:5173  │      │  localhost:3001       │      │  localhost:5432 │
└──────────────────┘      └───────────────────────┘      └─────────────────┘
```

The Vite dev server proxies `/api` to the API, so the browser only ever talks to one
origin. In Docker the proxy target comes from `VITE_API_PROXY`.

## Quick Start (Docker)

```bash
docker compose up -d --build
```

| Service   | URL                                |
|-----------|------------------------------------|
| Frontend  | http://localhost:5173              |
| API       | http://localhost:3001/api/v1       |
| Swagger   | http://localhost:3001/api/docs     |
| Health    | http://localhost:3001/api/v1/health|

On first boot the API creates the schema and seeds demo data (7 users across all
three surfaces, 5 companies, 8 candidates, 5 jobs, 2 applications, 1 placement)
then scores every candidate against every job.
Re-seeding is skipped whenever the `users` table is non-empty — start fresh with
`docker compose down -v`.

## Quick Start (Local Development)

Requires Node.js 20+ and PostgreSQL 16.

```bash
# 1. Database (or: docker compose up -d postgres)
createdb recruitment

# 2. API
cd backend
cp .env.example .env
npm install
npm run start:dev          # http://localhost:3001

# 3. Web
cd ../frontend
npm install
npm run dev                # http://localhost:5173
```

The API owns the schema in development (`DB_SYNCHRONIZE=true`). For a pre-provisioned
database, apply `database/schema.sql` and start the API with `DB_SYNCHRONIZE=false`.

## Demo Credentials

**Recruiter console** — http://localhost:5173/dashboard

| Email                    | Password      | Role        |
|--------------------------|---------------|-------------|
| admin@talentmatch.io     | admin123      | Super Admin |
| manager@talentmatch.io   | manager123    | Manager     |
| recruiter@talentmatch.io | recruiter123  | Recruiter   |

**Client portal** — http://localhost:5173/portal

| Email                   | Password  | Role         | Employer                     |
|-------------------------|-----------|--------------|------------------------------|
| client@habeshatech.et   | client123 | Client Admin | Habesha Tech Group           |
| hiring@habeshatech.et   | client123 | Client User  | Habesha Tech Group           |
| client@chaka.et         | client123 | Client Admin | Chaka Financial Technologies |

**Applicant** — http://localhost:5173/me

| Email               | Password     | Role      |
|---------------------|--------------|-----------|
| abebech@example.com | candidate123 | Candidate |

**Careers board** — http://localhost:5173/careers — no sign-in at all. Browse every
live public role and apply; setting a password on the form creates the login that
tracks it.

Sign in with any of them from the same page — you are routed to the surface your
role belongs to. Sign in as Habesha Tech and Chaka side by side to see that neither
can see the other's roles or candidates, and compare `client@habeshatech.et` with
`hiring@habeshatech.et` to see the account owner / reviewer split.

The seeded dataset is Ethiopian: clients in Addis Ababa, Adama, Bahir Dar and
Hawassa, candidates across those cities and Mekelle, and every salary in birr.
The sign-in screen reads its account list from `GET /auth/demo-accounts`, so it
follows whatever is actually in the database rather than a list kept in the client.

## Features

| Module | What it does |
|--------|--------------|
| **Auth** | JWT (7d), bcrypt hashes, permission guard on every route, last-login tracking |
| **Companies** | Employer accounts, Standard/VIP/Retainer tiers, status changes recorded to the pipeline |
| **Candidates** | Profiles, skill sets, verification flags, status changes recorded to the pipeline |
| **Jobs** | Postings with a DRAFT → PENDING_APPROVAL → APPROVED → LIVE gate; LIVE + PUBLIC puts a role on the careers board |
| **Careers board** | Unauthenticated: search live public roles by title, company, skill and location, and apply without an account |
| **Applications** | Inbound applications, a recruiter-set status and a plain-language timeline the applicant reads |
| **CVs** | Optional or required per role; type/signature-checked on upload, stored outside the web root, downloadable only by the recruiting team or the CV's owner |
| **Matching** | Weighted multi-factor scoring, per-job / per-candidate / full recalculation |
| **Dispatch** | Push selected or top-N candidates to a client; notifies the account manager and advances the pipeline |
| **Pipeline** | Candidate / company / placement state machines with validated transitions and full history |
| **Placements** | Fee calculation from salary × fee %, status, client satisfaction rating |
| **Analytics** | Dashboard metrics, success rate, fees, time-to-fill by industry, skill gap analysis, tier mix |
| **Client portal** | Employer login scoped to one company: review submitted talent, request interviews, ask for new roles, rate placements |
| **Applicant area** | Candidate login scoped to their own record: track each application's progress, withdraw, keep their profile current |

### Roles & Permissions

Roles map to permissions in `backend/src/modules/auth/permissions.ts` — the single
source of truth. Routes declare what they need with `@RequirePermissions()`; the
same list is returned to the client at login so the console renders only what the
account can actually do. Hiding a control is UX; the API is the boundary.

The split follows who owns the decision: recruiters run day-to-day sourcing, while
anything commercial — approving a role to go live, client tiers, signing off
verification, booking a placement fee — is a manager call. The table below covers
the console; `portal:*` and `me:*` are separate namespaces held only by employer and
applicant accounts respectively.

| Permission | Super Admin | Manager | Recruiter |
|---|:--:|:--:|:--:|
| `candidates:read` / `companies:read` / `jobs:read` | ✅ | ✅ | ✅ |
| `candidates:write` — add and edit talent | ✅ | ✅ | ✅ |
| `jobs:write` — draft postings | ✅ | ✅ | ✅ |
| `matching:read` / `matching:calculate` | ✅ | ✅ | ✅ |
| `matching:dispatch` — push talent to a client | ✅ | ✅ | ✅ |
| `pipeline:read` / `pipeline:transition` | ✅ | ✅ | ✅ |
| `placements:read` | ✅ | ✅ | ✅ |
| `analytics:read` — pipeline, gaps, time-to-fill | ✅ | ✅ | ✅ |
| `candidates:verify` — sign off checks | ✅ | ✅ | — |
| `jobs:approve` — approve, publish, change status | ✅ | ✅ | — |
| `companies:write` — accounts and tiers | ✅ | ✅ | — |
| `placements:write` — record placements and fees | ✅ | ✅ | — |
| `analytics:financials` — fees and revenue | ✅ | ✅ | — |
| `candidates:delete` / `jobs:close` | ✅ | ✅ | — |
| `users:read` — team roster | ✅ | ✅ | — |
| `users:write` — create accounts | ✅ | — | — |
| `companies:delete` / `placements:delete` | ✅ | — | — |

What this looks like in practice:

- **Recruiter** drafts a role and hits *Submit for approval*; they cannot set a job
  to `APPROVED`/`LIVE` through create or update either, so the gate cannot be
  side-stepped. They move candidates from screening through to offer but not to
  `PLACED`, and company stages are read-only for them.
- **Fee and salary figures are removed from API responses** without
  `analytics:financials`, so the recruiter console shows placement counts and
  satisfaction where a manager sees revenue — the numbers are absent from the
  payload, not just hidden in the UI.
- **Notifications are private**: you can read your own inbox; reading someone
  else's needs `users:read`.
- **Client roles** (`CLIENT_ADMIN`, `CLIENT_USER`) hold no console permission at
  all — they sign in to the client portal instead (below).
- **`CANDIDATE`** holds only the `me:*` namespace: their own profile and their own
  applications. Three namespaces, no overlap — a console route rejects a portal or
  candidate permission and vice versa, so no account can reach another surface's
  data by guessing a URL.

Sections a role cannot open are absent from the navigation, and a direct URL shows
which permission is missing rather than a wall of 403s.

## Posting and Applying

The two ends of the same loop. A role only reaches the outside world by passing
both gates, and an application only exists because somebody chose to make one.

### Posting a role

```
DRAFT ──submit──▶ PENDING_APPROVAL ──approve──▶ APPROVED ──publish──▶ LIVE
                                                                       │
                          visibility = PUBLIC ─────────────────────────┘
                                    ▼
                          on the careers board
```

A recruiter (`jobs:write`) drafts and submits; only `jobs:approve` — manager and
above — can approve or publish, and the service rejects a create or update that
tries to set `APPROVED`/`LIVE` directly, so the gate cannot be side-stepped through
the edit form. Publishing requires an `APPROVED` (or `PAUSED`) role and stamps
`published_at`.

**Status is not the same as reach.** A posting appears on the board only when it is
`LIVE` *and* `PUBLIC`; a `PRIVATE` or `CONFIDENTIAL` role stays internal however it
is published, and pausing or closing it removes it again — including from
`GET /public/jobs/:slug`, which stops resolving. The jobs page states which of the
two a role is missing rather than leaving a recruiter to infer it, and links
straight to the live listing.

### Applying to one

Anyone can apply, with no account:

1. `GET /public/jobs` — search live public roles by title, company, skill or
   location. Filtering happens before the page is cut, so a filter searches the
   whole board rather than the first fifty rows.
2. `POST /public/applications` — creates the candidate record if the email is new,
   or tops up only the *blank* fields on an existing one, so nothing a recruiter
   already established is overwritten. Re-applying to a role is refused while the
   earlier application is open, and allowed after a withdrawal — the earlier
   history is kept, not rewritten.
3. A password on the form is optional. Supplying one mints a `CANDIDATE` login —
   the role is forced server-side, because the endpoint is unauthenticated and must
   never be able to create anything else.
4. The account manager for the employer gets a notification either way.

### Applying with an account

Signing in changes two things, both about not retyping what we already hold.

The form opens prefilled from the profile — name, contact, current role, experience,
salary expectation, skills and the CV on file — and **every field stays editable**.
An edit is not discarded: the profile is updated with it before the application is
sent, because that is where those details came from. Email is the exception, being
the account's identity.

The submission goes to `POST /me/applications`, not the public endpoint. It carries
only a job id, a cover note and optionally a CV: the applicant's identity comes from
the token, so there is no name or email field that could disagree with the account.

### Asking for a CV

A role carries `requiresResume`. Off by default — asking for a document is a decision
the hiring team makes per role, not a tax on every applicant. Turn it on when posting
and the board shows a *CV required* badge, the form will not submit without one, and
the API refuses the application even if the form is bypassed.

Uploads are **append-only**. Replacing a CV writes a new file rather than overwriting,
so an application always resolves to the document that was actually sent with it, not
whatever the candidate uploaded three months later.

See [Handling uploaded CVs](#handling-uploaded-cvs) for what happens to the file.

### Following it

`/applications` in the console is where a recruiter answers. Setting a status writes
the plain-language note the applicant reads, and dispatch, an interview request and
a placement each move the application on the recruiter's behalf, so the applicant's
view stays honest without anyone remembering to update it.

The applicant sees it at `/me`: a progress rail across the six-step journey, the
timeline behind it, and a withdraw button. What they never see is the machinery —
match scores, which client was pitched, recruiter notes, or their internal pipeline
stage. `CandidateScopeGuard` resolves their candidate id from the token, never from
the request, so there is no id to substitute for somebody else's application.

## Handling uploaded CVs

A CV is a file a stranger chose, containing somebody's personal data. Both halves of
that shape the design.

### Accepting one

`POST /public/resumes` is the only unauthenticated write in the API that consumes
storage, so it is the most defended route here. Multer holds the upload **in memory**
— nothing a stranger sends touches the disk until it has been checked:

| Control | What it stops |
|---|---|
| 5 MB cap, one file, bounded parts | Filling the disk, or the process, with one request |
| Extension allowlist: `.pdf` `.doc` `.docx` | `.exe`, `.svg`, `.html` and everything else scriptable |
| Declared content type must match the extension | A file renamed to look acceptable |
| **Magic bytes must match too** | A PHP shell called `cv.pdf` — the header is `%PDF-`, or it is not a PDF |
| Stored name is the row's UUID, never the uploader's | Path traversal, overwriting, name collisions |
| Uploader's name kept only for display, control characters stripped | Response-header injection through a filename |
| 5 uploads / 15 min / address | Someone scripting the endpoint |
| Written `wx`, mode `0600`, SHA-256 recorded | Silent clobbering; tampering on the way back out |

The declared type is a *claim*; the signature is *evidence*. Both have to agree, and a
disagreement is a rejection rather than a guess — a `.pdf` that opens with a zip header
is not a file somebody named badly.

### Storing it

Files live under `UPLOAD_DIR` (a named Docker volume, never the bind-mounted source
tree) as `<uuid>.bin`. Nothing is served statically from there; the only route out is
the guarded download.

An anonymous upload is **unclaimed** until the application that uses it arrives, and
carries a 2-hour expiry. A sweep runs on boot and every 30 minutes to delete unclaimed
uploads that expired, and any file whose row has gone — a deleted candidate cascades
the row away but not the bytes. Files written inside the grace window are skipped, so
an upload in flight is never removed underneath its own request.

### Giving it back

`GET /resumes/:id` serves two callers: the recruiting team (`candidates:read`) and the
person whose CV it is. An employer is deliberately not on that list — the portal shows
what was formally submitted about a candidate, and a CV is not part of it. A CV you may
not read returns **404, not 403**, so the endpoint does not confirm that an id exists.

The response is always `Content-Disposition: attachment` with
`Content-Type: application/octet-stream`, `X-Content-Type-Options: nosniff`,
`Content-Security-Policy: default-src 'none'; sandbox` and `Cache-Control: private,
no-store`. A PDF rendered in-page is a scripting surface on this origin, and no
recruiter needs one to read a CV.

### Known limits

- The rate limiter is an **in-process fixed window**. It protects one instance, which
  suits a single container. Behind more than one replica, or anywhere the client IP is
  worth spoofing, it belongs in Redis or at the edge; the guard is the enforcement
  point to swap.
- No malware scanning. The type checks stop a file from *being* something else, not
  from *containing* something — a real PDF with a malicious payload is stored as a real
  PDF. Put a scanner in front of `ResumeStorageService.store()` before this faces real
  applicants.
- Files are stored as uploaded, not encrypted at rest. Disk-level encryption is the
  deployment's job.

## Client Portal

The employer-facing surface from the plan's client layer. An employer signs in at
the same page and lands on `/portal`; the console and the portal share no routes,
no permissions and no queries.

Two roles, split on **who commits the employer**. A Client User is a hiring
manager: they review the talent put in front of them and say yes or no. A Client
Admin is the account owner: everything that commits the company — opening a new
requisition, signing off a hire, granting a colleague access — is theirs.

| | Client Admin | Client User |
|---|:--:|:--:|
| `portal:jobs:read` — their own roles | ✅ | ✅ |
| `portal:candidates:read` — talent submitted to them | ✅ | ✅ |
| `portal:candidates:respond` — shortlist, request interview, decline | ✅ | ✅ |
| `portal:placements:read` — their hires | ✅ | ✅ |
| `portal:jobs:request` — brief a new role | ✅ | — |
| `portal:feedback:write` — rate a placement | ✅ | — |
| `portal:team:read` — see who at their company has access | ✅ | — |
| `portal:team:manage` — invite, promote, suspend colleagues | ✅ | — |

A Client User's portal is four screens and no create buttons. A Client Admin also
gets **Team access**, where they invite colleagues, promote one to co-owner, and
suspend leavers — without the agency having to do it for them.

### Guard rails on team management

An account owner administers *their own* company and nothing else:

- The new account's company is taken from the caller's token; a `companyId` in
  the request body is ignored.
- Only `CLIENT_ADMIN` and `CLIENT_USER` can be granted — an owner cannot mint an
  internal staff login.
- Another employer's user returns 404 on both suspend and promote.
- You cannot suspend or demote yourself, and the last active owner cannot be
  demoted, so an employer can never be stranded without an administrator.
- Suspending a leaver blocks their login immediately; the account manager is
  notified of every access change.

### How the scoping works

A portal account carries a `company_id`, which is signed into its token.
`ClientScopeGuard` reads it and writes `request.companyScope`; every portal query
takes its company from there and **never** from a route or query parameter, so
there is no id a client could substitute. Looking up another employer's record
returns 404 rather than 403 — the record simply is not in scope.

Portal permissions live in their own `portal:` namespace. A portal route rejects
console permissions and a console route rejects portal ones, so neither surface
can be reached from the other by any path.

### What a client can and cannot see

Visibility comes from `candidate_dispatches` — a candidate is visible to an
employer only once a recruiter has formally submitted them for one of that
employer's roles. Even then the profile is filtered:

- **Withheld**: email, phone, CV source, owning recruiter, parsed CV data, the
  raw verification record, and every fee or margin figure. Contact details are
  held back deliberately — a portal that hands over an email invites the client
  to go around the agency.
- **Shown**: name, current title, experience, skills, location, availability and
  salary expectation (needed to judge an offer), plus a single *Verified* badge.

### The response loop

A client's decision flows straight back into the console: requesting an interview
moves the candidate `SENT_TO_COMPANY → INTERVIEWING` with the reason recorded in
the pipeline history, and the account manager is notified. Recruiters see every
response at `GET /matches/dispatches`. A requested role arrives as a
`PENDING_APPROVAL`, `PRIVATE` posting — a client can brief a role but cannot put
one live.

### Matching Algorithm

Weighted score out of 100 (`backend/src/modules/matching/matching.service.ts`, `v2.1`):

| Factor | Weight | Basis |
|--------|--------|-------|
| Skills | 35% | Required skill coverage, scaled by proficiency vs. required level |
| Experience | 20% | Years against a 2-year floor / 5-year ideal |
| Location | 15% | Same city > same country > remote-friendly |
| Salary | 15% | Overlap between expectation and offered band |
| Culture | 10% | Company culture tags against candidate interests |
| Availability | 5% | Notice period bucket |

Scores are upserted against `UNIQUE(candidate_id, job_id)`, so recalculating is
idempotent rather than accumulating duplicates.

## API Reference

Full interactive documentation at `/api/docs`. Base path is `/api/v1`.

| Resource | Endpoints |
|----------|-----------|
| Auth | `POST /auth/login`, `POST /auth/register`, `GET /auth/me`, `GET /auth/roles`, `GET /auth/users`, `POST /auth/logout` |
| Companies | `GET/POST /companies`, `POST /companies/bulk`, `GET/PUT/DELETE /companies/:id`, `PATCH /companies/:id/status` |
| Candidates | `GET/POST /candidates`, `POST /candidates/bulk`, `GET/PUT/DELETE /candidates/:id`, `PATCH /candidates/:id/status`, `PATCH /candidates/:id/skills`, `PATCH /candidates/:id/verify` |
| Jobs | `GET/POST /jobs`, `GET/PUT/DELETE /jobs/:id`, `PATCH /jobs/:id/submit`, `PATCH /jobs/:id/approve`, `PATCH /jobs/:id/publish`, `PATCH /jobs/:id/status` |
| Public | `GET /public/jobs`, `GET /public/jobs/filters`, `GET /public/jobs/:slugOrId`, `POST /public/applications` — **no token** |
| Applications | `GET /applications`, `PATCH /applications/:id/status` |
| Resumes | `POST /public/resumes` (**no token**, rate limited) · `GET /resumes/:id` (staff or the CV's owner) |
| Candidate | `GET /me/summary`, `/me/profile`, `/me/applications`, `/me/applications/:id` · `PUT /me/profile` · `POST /me/applications`, `/me/resume` · `PATCH /me/applications/:id/withdraw` |
| Portal | `GET /portal/company`, `/overview`, `/jobs`, `/candidates`, `/candidates/:id`, `/placements`, `/team` · `POST /portal/jobs/request`, `/portal/team` · `PATCH /portal/candidates/:id/respond`, `/portal/placements/:id/feedback`, `/portal/team/:id/status`, `/portal/team/:id/role` |
| Matching | `GET /matches`, `GET /matches/dispatches`, `GET /matches/job/:id`, `GET /matches/candidate/:id`, `POST /matches/calculate`, `POST /matches/calculate/job/:id`, `POST /matches/calculate/candidate/:id`, `POST /matches/dispatch`, `POST /matches/batch-dispatch` |
| Pipeline | `GET /pipeline/stages`, `GET /pipeline/:type`, `GET /pipeline/:type/counts`, `GET /pipeline/:type/:id/history`, `POST /pipeline/transition` |
| Placements | `GET/POST /placements`, `GET/PUT/DELETE /placements/:id`, `PATCH /placements/:id/feedback` |
| Analytics | `GET /analytics/dashboard`, `/pipeline`, `/placements`, `/time-to-fill`, `/gap-analysis`, `/tier-distribution`, `/recent-activity`, `/revenue` (financials only) |
| Notifications | `GET /notifications/me`, `GET /notifications/user/:id`, `POST /notifications`, `POST /notifications/:id/read` |

Every route requires `Authorization: Bearer <token>` except `POST /auth/login`,
`GET /health` and everything under `/public` — the job board is the one
unauthenticated surface, and it serves a hand-picked set of fields from roles that
are both `LIVE` and `PUBLIC`.

### Example

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@talentmatch.io","password":"admin123"}' | jq -r .access_token)

curl -s http://localhost:3001/api/v1/analytics/dashboard -H "Authorization: Bearer $TOKEN"
```

## Pipeline State Machines

Transitions are enforced server-side; an illegal move returns 400 with the allowed set.

```
COMPANY    LEAD → ONBOARDED → ACTIVE → FULFILLED → (ACTIVE | INACTIVE)
           LEAD → REJECTED

CANDIDATE  UNASSIGNED → SCREENING → MATCHED → SENT_TO_COMPANY → INTERVIEWING
                      → OFFERED → PLACED → ARCHIVED
           (SCREENING | MATCHED | SENT_TO_COMPANY | INTERVIEWING | OFFERED) → REJECTED

PLACEMENT  ACTIVE → (COMPLETED | TERMINATED) → ARCHIVED
```

## Project Structure

```
recruitment-platform/
├── backend/
│   ├── src/
│   │   ├── database/            # Snake-case naming strategy, numeric transformer
│   │   ├── common/guards/       # Rate limiting
│   │   ├── entities/            # TypeORM entities (12 tables)
│   │   ├── modules/
│   │   │   ├── auth/            # Login, permission matrix + guard
│   │   │   ├── companies/       # Employer accounts and tiers
│   │   │   ├── candidates/      # Profiles, skills, verification
│   │   │   ├── jobs/            # Postings, approval, publishing
│   │   │   ├── matching/        # Scoring engine and talent dispatch
│   │   │   ├── pipeline/        # State machines and transition history
│   │   │   ├── placements/      # Placements, fees, feedback
│   │   │   ├── portal/          # Client portal, company-scoped
│   │   │   ├── public/          # Unauthenticated job board and apply
│   │   │   ├── resumes/         # CV validation, storage, sweep and download
│   │   │   ├── me/              # Applicant self-service, candidate-scoped
│   │   │   ├── applications/    # Inbound applications and their status
│   │   │   ├── analytics/       # Metrics and gap analysis
│   │   │   └── notifications/   # In-app notifications
│   │   ├── seed/                # First-boot demo data + initial match scores
│   │   ├── health.controller.ts
│   │   ├── main.ts
│   │   └── app.module.ts
│   ├── nest-cli.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/          # Layout, Modal, ProtectedRoute
│   │   ├── contexts/            # Auth context
│   │   ├── lib/api.ts           # Fetch client: auth header, errors, 401 handling
│   │   ├── pages/               # Console pages
│   │   ├── pages/portal/        # Client portal pages
│   │   ├── pages/public/        # Careers board and role detail (no session)
│   │   ├── pages/candidate/     # Applicant tracker and profile
│   │   ├── types.ts             # Shared API types
│   │   └── App.tsx
│   └── Dockerfile
├── database/schema.sql          # Reference DDL
└── docker-compose.yml
```

## Configuration

Backend environment variables (see `backend/.env.example`):

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | 3001 | API port |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | localhost / 5432 / postgres / postgres / recruitment | Connection |
| `DB_SYNCHRONIZE` | `true` | Set `false` when the schema is managed by `schema.sql` or migrations |
| `DB_LOGGING` | `false` | Log SQL |
| `JWT_SECRET` | dev default | **Change before deploying** |
| `CORS_ORIGIN` | any | Restrict in production |
| `UPLOAD_DIR` | `./storage/resumes` | Where CVs are written. Must be writable, and must not be served statically — see [Handling uploaded CVs](#handling-uploaded-cvs). In Docker this is a named volume, so CVs survive a rebuild and never land in the repository. |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite, Recharts, lucide-react |
| Backend | NestJS 10, TypeORM 0.3, class-validator, Swagger |
| Database | PostgreSQL 16 (JSONB, array columns, GIN indexes) |
| Auth | JWT, bcryptjs, role-based guards |
| DevOps | Docker, Docker Compose, container healthchecks |

## Not Yet Built

Deliberately out of scope for this MVP; see the implementation plan for the full target:

- Resume parsing service (Python/FastAPI, `POST /candidates/parse-resume`) — CVs are
  stored and served, but never read or indexed
- Malware scanning on uploads (see [Known limits](#known-limits))
- Distributed rate limiting (the current guard is per-process)
- Elasticsearch search, Redis cache, RabbitMQ event bus
- Email delivery (notifications are persisted and shown in-app only)
- Interview scheduling, background-check and CRM integrations

## License

MIT
