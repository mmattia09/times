# Athletics Performance Tracker

A self-hosted web app for tracking athletics training and competition results —
sprint times, jumps, throws and cross-country — with personal bests, charts, a REST
API, and automatic import from a [FIDAL](https://www.fidal.it) athlete profile.

Built for an Italian sprinter migrating from a Notion database. The UI is in Italian;
dates render in `Europe/Rome`.

## Stack

- **Next.js 16** (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Recharts
- **PostgreSQL 16** + **Drizzle ORM**
- **Better Auth** (email/password, session cookies)
- **Cheerio** for the server-side FIDAL scraper
- **pnpm** workspaces · **Docker** / Docker Compose

## Quick start (Docker)

```bash
cp .env.example .env
# Edit .env: set a real BETTER_AUTH_SECRET (openssl rand -base64 32) and DB_PASSWORD.
docker compose up --build
```

On boot the `app` container runs migrations, seeds the database (idempotent) and starts
the server at <http://localhost:3000>. Log in with the seed user
(`SEED_USER_EMAIL` / `SEED_USER_PASSWORD`, default `changeme` — change it after first login).

### Using the published image

CI ([`.github/workflows/docker-image.yml`](.github/workflows/docker-image.yml)) builds and
pushes a multi-arch image to GHCR on every push to `main` and on `v*.*.*` tags. To run that
instead of building locally, set `APP_IMAGE` in `.env` and pull:

```bash
echo "APP_IMAGE=ghcr.io/<owner>/<repo>:latest" >> .env
docker compose pull app && docker compose up -d
```

## Local development

```bash
pnpm install
docker compose up -d db           # Postgres only
cp .env.example apps/web/.env.local   # Next.js reads env from the app dir
pnpm db:migrate
pnpm db:seed                      # imports the bundled Notion export
pnpm dev                          # http://localhost:3000
```

Scripts (run from the repo root): `db:generate`, `db:migrate`, `db:push`, `db:seed`,
`db:studio`, `dev`, `build`, `start`, `lint`.

## Data model

The Notion source is a *wide* table (one row per date, a column per discipline). The app
normalizes this into **sessions** (one training day or competition) each owning one or more
**performances**. Personal bests are recomputed on every write and stored in `personal_bests`.

### Units & "better" direction

| Discipline        | Events                         | Stored unit | Better |
| ----------------- | ------------------------------ | ----------- | ------ |
| `sprint`          | 40–400 m runs                  | seconds     | lower  |
| `middle_distance` | 2 km campestre (cross country) | minutes     | lower  |
| `jump`            | alto, lungo                    | centimetres | higher |
| `throw`           | giavellotto                    | metres      | higher |

Values are preserved exactly as recorded in Notion/FIDAL (no cm↔m conversion), so PB
comparisons are always within a single unit.

## REST API (`/api/v1`)

Authenticated with an API key generated in **Settings → Chiavi API**. Pass it as
`Authorization: Bearer <key>`.

| Method & path                | Description                              |
| ---------------------------- | ---------------------------------------- |
| `GET    /api/v1/sessions`    | List sessions (`from,to,type,distance,season,…`) |
| `POST   /api/v1/sessions`    | Create a session + performances          |
| `GET    /api/v1/sessions/:id`| Get one session                          |
| `PUT    /api/v1/sessions/:id`| Replace a session                        |
| `DELETE /api/v1/sessions/:id`| Delete a session                         |
| `GET    /api/v1/performances`| List performances (`distance,from,to`)   |
| `GET    /api/v1/records`     | Personal bests per event                 |
| `GET    /api/v1/fidal/preview`| Dry-run FIDAL import (new vs skipped)    |
| `POST   /api/v1/fidal/sync`  | Commit FIDAL import                      |

```bash
curl -H "Authorization: Bearer ath_live_…" http://localhost:3000/api/v1/records
```

## FIDAL integration

Configure your athlete profile URL in **Settings → Integrazione FIDAL**. The scraper
(server-side only) fetches the profile, parses each `table.table` (one per specialità),
maps the events, and dedups by a hash of `date + specialità + prestazione` stored as
`fidalId`. Use **Testa connessione** for a dry-run preview, then **Sincronizza ora** to
import only new results.

## Workouts (schede)

The **Schede** page is a library of structured workouts in the classic coach-table
format — blocco · ripetute · recupero · pausa · ritmo · note, all free text
("4 x 60m", "passo", "2' 30\"", "max"). Attach a scheda to a training session from
the session form: the blocks are snapshotted onto the session, so editing a
template later never rewrites your training history.

## Goals (obiettivi)

On the Records page you can set a target per event ("100m in 11.80"). Each goal
shows your current wind-legal PB, how much is missing, and a progress meter;
it flips to **raggiunto** when the PB beats the target.

## Import / Export

**Settings → Dati** exports everything as a single JSON file — sessions with
performances and workouts, workout templates, goals, settings, and API keys
(hashes only; passwords are never exported). Import is idempotent: existing
records are skipped, never duplicated. Moving to a new instance is
*export → register → import*. For scripted migrations use
`GET /api/v1/export` and `POST /api/v1/import` with an API key.

## Project layout

```
apps/web/
  app/(auth)        login / register
  app/(dashboard)   dashboard · sessions · workouts · records · settings
  app/api/auth      Better Auth handler
  app/api/internal  session-cookie API (used by the UI)
  app/api/v1        external REST API (API-key auth)
  components/{ui,charts,forms,layout,sessions,settings,workouts,records}
  lib/{db,auth,api-key,fidal,fidal-sync,records,services,athletics,season,format,data-transfer}
docker/             Dockerfile + entrypoint
docker-compose.yml  db + app
```

## Multi-user

The app is multi-user: every record (sessions, performances, PBs, API keys, settings,
FIDAL URL) is scoped to a `userId`, and each request only ever reads its owner's rows, so
registered accounts are fully isolated from one another. Registration is open by default;
set `DISABLE_REGISTRATION=true` to block new sign-ups (the `/register` page and the
`sign-up` API return to login / 403) after you've created your account(s).

## Notes

- All timestamps are stored UTC; the UI formats them in `Europe/Rome` with the Italian locale.
- The FIDAL scraper never runs client-side.
- API-key auth (`/api/v1/*`) is independent from session auth (everything else).
- No personal data is committed: `.env*`, the real Notion export and local build artifacts
  are git/Docker-ignored; only an anonymized sample CSV ships for seeding demos.
