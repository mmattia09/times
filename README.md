# Times

A self-hosted web app for tracking athletics — training sessions and competitions,
personal bests, season bests, goals and training schemes — with charts, a REST API,
and an optional importer from a [FIDAL](https://www.fidal.it) athlete profile.

The app ships **empty**: you create your account and your data. The UI is in Italian;
dates render in `Europe/Rome`.

> Built for a sprinter, useful for any track & field athlete: sprints, hurdles, middle
> and long distance, relays, race walking, jumps, throws and combined events are all
> first-class, each with the correct "better is lower/higher" direction and units.

---

## Features

- **Sessions & performances** — log a training day or a competition; one session can hold
  several results (e.g. 100m heat + 200m final). Filter by season, type, discipline,
  level, organiser and indoor/outdoor.
- **Personal & season bests** — recomputed on every write. Wind is respected: a tailwind
  above **+2.0 m/s** marks a result *ventosa* — kept and charted, but not eligible as a
  record (FIDAL / World Athletics rule).
- **Charts** — progress over time, best per season, improvement curve, and a training-volume
  view; theme-aware and colour-blind-safe.
- **Goals** — set a target per event and watch the gap to your current PB close.
- **Training schemes (schede)** — a library of structured workouts in the classic
  coach-table format (blocco · ripetute · recupero · pausa · ritmo · note); attach one to a
  training session as a snapshot.
- **Two seasons per year** — *estiva* (Apr–Sep, outdoor) and *invernale* (Oct–Mar, indoor).
- **FIDAL import** — paste your athlete profile URL; the server scrapes and imports your
  official results, de-duplicated.
- **Full JSON import/export** — one file with everything; moving to a new instance is
  *export → register → import*.
- **REST API** — `/api/v1/*` with per-user API keys.
- **Multi-user** — every account is fully isolated. One admin (managed from the
  environment) plus self-service accounts.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Recharts · PostgreSQL 16 +
Drizzle ORM · Better Auth · Cheerio · pnpm workspaces · Docker.

---

## Quick start (Docker)

```bash
cp .env.example .env
# Edit .env: set BETTER_AUTH_SECRET (openssl rand -base64 32), ADMIN_EMAIL, ADMIN_PASSWORD.
docker compose up --build
```

On boot the app runs database migrations and provisions the admin account, then serves at
<http://localhost:3000>. Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

### Run the published image

CI ([`.github/workflows/docker-image.yml`](.github/workflows/docker-image.yml)) builds and
pushes an image to GHCR on every push to `main` and on `v*.*.*` tags. To run it instead of
building locally, set `APP_IMAGE` in `.env` and pull:

```bash
echo "APP_IMAGE=ghcr.io/<owner>/<repo>:latest" >> .env
docker compose pull app && docker compose up -d
```

## Configuration (`.env`)

| Variable              | Purpose                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `DB_PASSWORD`         | Password for the Postgres container.                               |
| `DATABASE_URL`        | Postgres connection string.                                        |
| `BETTER_AUTH_SECRET`  | Session-signing secret (`openssl rand -base64 32`).                |
| `BETTER_AUTH_URL`     | Public URL where the app is reachable.                             |
| `ADMIN_EMAIL`         | Admin login email (see below).                                     |
| `ADMIN_PASSWORD`      | Admin login password.                                              |
| `DISABLE_REGISTRATION`| `true` to block new sign-ups once your accounts exist.             |
| `APP_IMAGE`           | Optional: published image to run instead of building.              |

## Accounts

- **Admin** — the first user, provisioned from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. These are
  the *only* way to change the admin's login: edit `.env` and restart, and the credentials
  re-sync. The admin cannot change their email or password from the UI.
- **Everyone else** — registers through the app and manages their own name, email and
  password in **Settings**. Set `DISABLE_REGISTRATION=true` after creating your accounts to
  close sign-ups.

## Local development

```bash
pnpm install
docker compose up -d db                 # Postgres only
cp .env.example apps/web/.env.local      # Next.js reads env from the app dir
pnpm db:migrate
pnpm db:seed                             # provisions the admin account
pnpm dev                                 # http://localhost:3000
```

Scripts (from the repo root): `dev`, `build`, `start`, `lint`, `db:generate`, `db:migrate`,
`db:push`, `db:seed`, `db:studio`.

## REST API (`/api/v1`)

Authenticated with an API key generated in **Settings → Chiavi API**
(`Authorization: Bearer <key>`).

| Method & path                 | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `GET/POST /api/v1/sessions`   | List / create sessions (with performances)    |
| `GET/PUT/DELETE …/sessions/:id` | Read / replace / delete a session           |
| `GET /api/v1/performances`    | List performances (`distance,from,to`)        |
| `GET /api/v1/records`         | Personal bests per event                      |
| `GET /api/v1/export`          | Full JSON export                              |
| `POST /api/v1/import`         | Import a JSON export (idempotent)             |
| `GET /api/v1/fidal/preview`   | Dry-run FIDAL import                          |
| `POST /api/v1/fidal/sync`     | Commit FIDAL import                           |

## Project layout

```
apps/web/
  app/(auth)        login / register
  app/(dashboard)   dashboard · sessions · workouts · records · settings
  app/api/auth      Better Auth handler
  app/api/internal  session-cookie API (used by the UI)
  app/api/v1        external REST API (API-key auth)
  components/{ui,charts,forms,layout,sessions,settings,workouts,records,dashboard}
  lib/{db,auth,api-key,fidal,fidal-sync,records,services,athletics,season,format,data-transfer}
docker/             Dockerfile + entrypoint
docker-compose.yml  db + app
```

## Notes

- Timestamps are stored UTC and shown in `Europe/Rome` (Italian locale).
- The FIDAL scraper runs server-side only.
- API-key auth (`/api/v1/*`) is independent from session auth.
- The repo contains no personal data; `.env*` and build artifacts are git-ignored.
