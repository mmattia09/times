# Athletics Performance Tracker

A self-hosted web app for tracking athletics training and competition results —
sprint times, jumps, throws and cross-country — with personal bests, charts, a REST
API, and automatic import from a [FIDAL](https://www.fidal.it) athlete profile.

Built for an Italian sprinter migrating from a Notion database. The UI is in Italian;
dates render in `Europe/Rome`.

## Stack

- **Next.js 15** (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Recharts
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

## Project layout

```
apps/web/
  app/(auth)        login / register
  app/(dashboard)   dashboard · sessions · records · settings
  app/api/auth      Better Auth handler
  app/api/internal  session-cookie API (used by the UI)
  app/api/v1        external REST API (API-key auth)
  components/{ui,charts,forms,layout,sessions,settings}
  lib/{db,auth,api-key,fidal,fidal-sync,records,services,athletics,season,format}
docker/             Dockerfile + entrypoint
docker-compose.yml  db + app
```

## Notes

- All timestamps are stored UTC; the UI formats them in `Europe/Rome` with the Italian locale.
- The FIDAL scraper never runs client-side.
- API-key auth (`/api/v1/*`) is independent from session auth (everything else).
- To lock down registration after creating your account, remove the `/register` route or
  put the app behind your own auth proxy.
```
