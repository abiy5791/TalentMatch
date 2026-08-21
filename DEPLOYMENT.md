# Deploying to Vercel

This repository deploys as **two Vercel projects from one Git repository**:

| Project  | Root directory | What it is                                 |
| -------- | -------------- | ------------------------------------------ |
| API      | `backend`      | NestJS, running as one serverless function |
| Frontend | `frontend`     | The Vite build, served as static files     |

Plus a **Postgres database**, which Vercel does not host itself — you bring one.

Two projects rather than one because the halves want different things: the
frontend is static files on a CDN, the API is a Node function holding a database
connection. Splitting them means a frontend deploy cannot break the API, and each
scales on its own.

About 25 minutes. Everything below works on Vercel's free Hobby plan.

---

## Before you start

- A [Vercel account](https://vercel.com/signup)
- This repository pushed to GitHub, GitLab or Bitbucket
- Node 20+ locally (`node --version`) — needed once, to set up the database

---

## Step 1 — Create the Postgres database

Any Postgres works. [Neon](https://neon.tech) is the path of least resistance: it
has a free tier, and its pooled endpoint is what serverless needs.

1. Sign up at [neon.tech](https://neon.tech) and create a project.
2. Region: pick the one nearest your users. Note it — you will match the
   function's region to it in Step 2, and a database on another continent adds a
   round trip to every single query.
3. From the dashboard, copy the **Pooled connection** string:

   ```
   postgresql://user:password@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

> **Use the pooled string, not the direct one.** Look for `-pooler` in the
> hostname. Every concurrent function instance opens its own connection, and
> Postgres runs out of connection slots long before Vercel runs out of instances.
> The pooler is what keeps that from happening.

Using something else? Supabase: *Connection string → Transaction pooler*. AWS
RDS: put PgBouncer in front. Any provider is fine as long as the endpoint pools.

### Generate a JWT secret

Sessions are signed with this. Generate a real one now — the app refuses to start
in production without it, deliberately, because the alternative is signing tokens
with a value published in this repository.

```bash
openssl rand -base64 48
```

No `openssl` on Windows:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Keep both values to hand. You need them in the next step.

---

## Step 2 — Deploy the API

1. In Vercel, click **Add New → Project** and import this repository.
2. **Root Directory: `backend`.** Click *Edit* next to Root Directory and pick
   the `backend` folder. This is the setting people miss, and everything else
   fails if it is wrong.
3. Framework Preset: **Other**. Leave build and output settings alone —
   `backend/vercel.json` already sets them.
4. Name it something you will recognise, e.g. `recruitment-api`.
5. Expand **Environment Variables** and add:

   | Name           | Value                                   |
   | -------------- | --------------------------------------- |
   | `DATABASE_URL` | The pooled connection string from Step 1 |
   | `JWT_SECRET`   | The secret you generated                 |
   | `NODE_ENV`     | `production`                             |

   Leave `CORS_ORIGIN` out for now — you do not know the frontend's URL yet, and
   Step 5 comes back for it.

6. Click **Deploy** and wait for the build.
7. Open **Settings → Functions** and set the region to match your database's.

You now have an API URL like `https://recruitment-api.vercel.app`. Visit it — you
should get a small landing page, and `/api/docs` should give you Swagger.

`/api/v1/health` will report `"database": "down"` at this point. That is correct:
the database exists but has no tables yet. Step 3 fixes it.

---

## Step 3 — Create the schema and load the data

The API does **not** create its own tables on Vercel, on purpose: a serverless
app "boots" on every cold start, and several instances altering a schema
concurrently is how you get a half-migrated database. So you do it once, from
your machine, deliberately.

```bash
cd backend
npm install

# Point at the deployed database. Use the DIRECT connection string here if your
# provider gives you one — schema changes are one long-lived session, which is
# the single job a transaction pooler is bad at.
export DATABASE_URL="postgresql://user:password@ep-...neon.tech/neondb?sslmode=require"
export JWT_SECRET="the-secret-you-generated"

npm run build
npm run db:setup
```

On Windows PowerShell use `$env:DATABASE_URL = "..."` instead of `export`.

`db:setup` creates the tables, then loads the demo dataset — an Ethiopian
recruitment desk, salaries in birr, a handful of companies, candidates and live
roles. It is idempotent: run it twice and the second run finds users already
there and stops.

Three commands, if you want them separately:

| Command             | Does                                         |
| ------------------- | -------------------------------------------- |
| `npm run db:schema` | Creates/updates tables to match the entities |
| `npm run db:seed`   | Loads the demo data, only if empty           |
| `npm run db:setup`  | Both, in that order                          |

Check it took:

```bash
curl https://recruitment-api.vercel.app/api/v1/health
# {"status":"ok","database":"up","timestamp":"..."}
```

> **Deploying for real rather than demoing?** Skip the seed. Run
> `npm run db:schema` alone, then create your first admin by hand — the seeded
> logins below are published in this repository and anyone can read them.

---

## Step 4 — Deploy the frontend

1. **Add New → Project**, and import the *same repository* again.
2. **Root Directory: `frontend`.**
3. Framework Preset: **Vite** (Vercel detects this).
4. Add one environment variable:

   | Name           | Value                                |
   | -------------- | ------------------------------------ |
   | `VITE_API_URL` | `https://recruitment-api.vercel.app` |

   Your API URL from Step 2, with **no trailing slash and no `/api/v1`** — the
   client appends that itself.

5. **Deploy.**

> `VITE_API_URL` is compiled into the JavaScript bundle at build time, not read
> at runtime. Changing it later means redeploying the frontend, not just
> restarting it.

---

## Step 5 — Let the API accept the frontend

The API rejects cross-origin calls from domains it does not know. Right now that
includes your new frontend, so sign-in will fail until you do this.

1. Open the **API** project → **Settings → Environment Variables**.
2. Add:

   | Name          | Value                                |
   | ------------- | ------------------------------------ |
   | `CORS_ORIGIN` | `https://recruitment-web.vercel.app` |

   Your frontend's URL, exactly: `https`, no trailing slash, no path. Several
   origins go in comma-separated — add your custom domain here too, once you
   have one.

3. **Deployments → ⋯ on the latest → Redeploy.** Environment variables are read
   at boot, so a running deployment will not pick this up on its own.

---

## Step 6 — Check it works

Open the frontend URL and sign in. The demo accounts:

| Role        | Email                      | Password       |
| ----------- | -------------------------- | -------------- |
| Super admin | `admin@talentmatch.io`     | `admin123`     |
| Manager     | `manager@talentmatch.io`   | `manager123`   |
| Recruiter   | `recruiter@talentmatch.io` | `recruiter123` |

Worth walking through in this order, because each step exercises a different part
of the stack:

- **`/careers`** — the public job board, no login. Proves unauthenticated reads.
- **Apply to a role with a CV attached** — proves upload and storage.
- **Sign in as the recruiter, open Applications, download that CV** — proves
  authenticated download and the permission check guarding it.
- **Dashboard and Analytics** — proves the heavier aggregate queries finish
  inside the function's time limit.

If sign-in fails, go to *CORS* under Troubleshooting.

---

## What changes when the app runs serverless

The app behaves differently on Vercel than it does under Docker. These are
deliberate, and worth knowing before one of them surprises you.

### CVs are stored in Postgres, not on disk

A Vercel function's filesystem is read-only apart from `/tmp`, and `/tmp` is
discarded when the instance is recycled. A CV written there would be accepted and
then quietly disappear.

So on Vercel the bytes go into a `bytea` column on `resume_files` instead. The
service picks this automatically — nothing to configure. Under Docker it still
uses the disk, unchanged.

The security model is identical either way: nothing serves these files
statically, and `GET /api/v1/resumes/:id` checks the caller before returning a
byte. What changes is your database size — budget roughly 1 MB per CV and watch
it against your provider's storage limit.

Outgrowing that is the point to move to object storage (Vercel Blob, S3). The
driver in `backend/src/modules/resumes/resume-storage.service.ts` is the single
place that would change.

Override with `RESUME_STORAGE=fs` or `RESUME_STORAGE=db` if you ever need to.

### Uploads are capped at 4 MB, not 5

Vercel refuses a request body over 4.5 MB before your function is invoked, so a
5 MB limit could be neither enforced nor explained — the applicant would just see
the upload die. The limit drops to 4 MB automatically on Vercel. Set
`MAX_RESUME_MB` to change it.

### Rate limiting counts per instance

The limiter on the public upload and apply routes holds its counters in memory.
Under Docker that is one process and the limit is exact. On Vercel there are
several instances, each with its own counters, so the effective limit is roughly
*instances × limit*. The routes are still protected against one attacker
hammering one instance, but it is not a hard cap.

If that matters,
[Vercel's WAF rate limiting](https://vercel.com/docs/security/vercel-waf)
enforces it at the edge, before the function runs — which is the right layer for
it anyway.

### The first request after idle is slow

Vercel freezes instances that go unused. The next request pays for a Nest
bootstrap plus a database connection, typically 1–3 seconds. Requests after it
reuse the warm instance and are fast. Nothing is broken; this is how the platform
works.

### The seeder does not run on boot

Every cold start would otherwise count as a "boot". It is off on Vercel, and
`npm run db:seed` is how you load data. `SEED_ON_BOOT=true` forces it back on if
you really want that.

---

## Environment variables in full

### API project

| Name                         | Required | Default            | Notes                                             |
| ---------------------------- | -------- | ------------------ | ------------------------------------------------- |
| `DATABASE_URL`               | **yes**  | —                  | Pooled Postgres connection string                 |
| `JWT_SECRET`                 | **yes**  | —                  | 32+ characters. The app refuses to start without it |
| `NODE_ENV`                   | yes      | —                  | `production`                                      |
| `CORS_ORIGIN`                | yes      | reflect any origin | Comma-separated frontend origins                  |
| `JWT_EXPIRES_IN`             | no       | `7d`               | Session lifetime                                  |
| `RESUME_STORAGE`             | no       | `db` on Vercel     | `fs` or `db`                                      |
| `MAX_RESUME_MB`              | no       | `4` on Vercel      | Upload ceiling                                    |
| `DB_SSL`                     | no       | `true` on Vercel   |                                                   |
| `DB_SSL_REJECT_UNAUTHORIZED` | no       | `false`            | `true` if your provider gives a chain Node trusts  |
| `DB_POOL_MAX`                | no       | `1` on Vercel      | Connections per instance                          |
| `DB_SYNCHRONIZE`             | no       | `false` on Vercel  | Leave it off. Use `npm run db:schema`             |
| `SEED_ON_BOOT`               | no       | `false` on Vercel  | Leave it off                                      |
| `DB_LOGGING`                 | no       | `false`            | Logs every query — noisy, useful when stuck        |

### Frontend project

| Name           | Required | Notes                                  |
| -------------- | -------- | -------------------------------------- |
| `VITE_API_URL` | yes      | API origin, no trailing slash, no path |

---

## Custom domains

1. **Frontend project → Settings → Domains**, add e.g. `talentmatch.io`.
2. **API project → Settings → Domains**, add e.g. `api.talentmatch.io`.
3. Follow Vercel's DNS instructions. TLS is issued automatically.
4. Update both sides to match, or you will break what was working:
   - Frontend `VITE_API_URL` → `https://api.talentmatch.io`
   - API `CORS_ORIGIN` → `https://talentmatch.io`
5. **Redeploy both.** The frontend because its variable is compiled in, the API
   because variables are read at boot.

---

## Same-origin instead of CORS (optional)

Prefer no cross-origin calls at all? Have the frontend proxy `/api` to the API,
and the browser only ever sees one origin.

Add the `/api` rule to `frontend/vercel.json`, **above** the SPA catch-all —
rewrites match in order, and the catch-all would otherwise swallow it:

```json
"rewrites": [
  { "source": "/api/:path*", "destination": "https://recruitment-api.vercel.app/api/:path*" },
  { "source": "/(.*)", "destination": "/index.html" }
]
```

Then **remove** `VITE_API_URL` from the frontend project, so the client goes back
to same-origin paths, and redeploy.

The trade: no CORS to configure and no preflight on each call, but every API
request takes an extra hop through Vercel's edge. It also cannot be changed from
the dashboard — the destination is hardcoded in a committed file, so a new API
URL means a commit.

---

## Troubleshooting

### Sign-in fails, console shows a CORS error

`CORS_ORIGIN` on the API does not match the frontend's origin. It must be exact:
scheme included, no trailing slash, no path. `https://app.vercel.app/` and
`https://app.vercel.app` are different values here. Fix it and **redeploy the
API** — changing a variable alone does nothing to a running deployment.

Vercel preview deployments get a fresh URL each time, so previews fail CORS
unless you add them too.

### `500: FUNCTION_INVOCATION_FAILED` on every route

Open the API project → **Logs** and read the first error. Usually one of:

- **`JWT_SECRET is not set`** — add it and redeploy. This is the app refusing to
  sign sessions with a fallback value published in this repository.
- **`No metadata for "X" was found`** — an entity missing from
  `backend/src/entities/index.ts`. Every entity must be listed there; a
  serverless bundle only contains files something statically imports, so a glob
  would silently leave entities out.
- **`getaddrinfo ENOTFOUND`** — the `DATABASE_URL` hostname is wrong.

### `/api/v1/health` says `"database": "down"`

- Tables not created yet → run `npm run db:setup` (Step 3).
- `self signed certificate in certificate chain` → set `DB_SSL=true`.
- **`too many clients already`** → you are on the direct connection string, not
  the pooled one. Switch to the `-pooler` host and redeploy.

### `504: FUNCTION_INVOCATION_TIMEOUT`

Usually the database is far from the function. Set the function region
(**Settings → Functions**) to match the database's region. Raise `maxDuration` in
`backend/vercel.json` if a genuinely slow query needs it — Hobby allows up to 60.

### Uploading a CV returns 413

The file is over the limit. Vercel's hard ceiling is 4.5 MB per request body, and
nothing in this app can raise it — that is the platform, not the code.

### The build works locally but `tsc` fails on Vercel with `TS2307: Cannot find module`

A source file exists on your machine but was never committed, so Vercel's clone
does not have it. `.gitignore` is the usual reason, and it fails silently — an
ignored file never shows up in `git status`, so nothing hints that it is missing.

Ask git what it would actually deploy:

```bash
git ls-files --others --ignored --exclude-standard | grep -v node_modules
```

Anything in that list which is real source is your problem. `git add -f <file>`
recovers it, but fix the rule too, or the next file to land there disappears the
same way.

Watch for **unanchored directory patterns**. `lib/` matches at every depth, not
just the root, so a Python-venv rule will happily swallow `frontend/src/lib/`.
Anchor root-only artefacts with a leading slash — `/lib/` — and leave patterns
like `dist/` unanchored only where you really do mean "at any depth".

### The frontend 404s when you refresh at `/dashboard`

The SPA rewrite in `frontend/vercel.json` is missing or was edited. Every path
has to fall through to `/index.html` so React Router can handle it.

### Changed an environment variable and nothing happened

Variables are read at boot. Redeploy: **Deployments → ⋯ → Redeploy**. For the
frontend, `VITE_*` variables are compiled into the bundle, so a rebuild is
genuinely required.

---

## Deploying updates

Both projects watch the same repository. Push to `main` and both rebuild — the
API when `backend/**` changes, the frontend when `frontend/**` does.

**When you change an entity**, the schema does not follow on its own. After the
deploy finishes, run against the production database:

```bash
cd backend && npm run build && npm run db:schema
```

`db:schema` adds columns and tables to match your entities. It does not write
migrations and will not always do the safe thing with a destructive change —
renaming a column reads to it as *drop one, add another*, and the data in it is
gone. Once you have real data in there, TypeORM migrations are the tool for this,
not this command.

---

## Still running it locally

Unchanged. Docker Compose still brings up Postgres, the API and the frontend
together, with CVs on a volume and the seeder running on boot:

```bash
docker compose up
```

- Frontend: http://localhost:5173
- API: http://localhost:3001/api/v1
- Docs: http://localhost:3001/api/docs

Nothing in the Vercel setup changes how this works. The two deployment shapes
share one codebase and differ only in the environment they are handed.
