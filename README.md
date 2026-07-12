# Times

[![CI](https://img.shields.io/github/actions/workflow/status/mmattia09/times/ci.yml?branch=main&label=CI)](https://github.com/mmattia09/times/actions/workflows/ci.yml)
[![Docker image](https://img.shields.io/github/actions/workflow/status/mmattia09/times/docker-image.yml?branch=main&label=docker)](https://github.com/mmattia09/times/actions/workflows/docker-image.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A self-hosted web app for track & field athletes: log training sessions and
competitions, track personal and season bests, set goals, keep a library of
structured workouts, and visualise your progress — all on your own server.

Built by a sprinter to replace a Notion database; useful for any athletics
discipline. The UI is in Italian; dates render in `Europe/Rome`.

## Features

- **Sessions & performances** — a training day or a competition, with any number of
  results (e.g. 100m heat + 200m final). Filters by season, type, discipline, level,
  organiser, indoor/outdoor.
- **Personal & season bests** — recomputed on every write. Wind-aware: a tailwind above
  **+2.0 m/s** flags the mark *ventosa* (kept and charted, but never a record — the
  [FIDAL](https://www.fidal.it) / World Athletics rule).
- **All disciplines first-class** — sprints, hurdles, middle/long distance, relays, race
  walking, jumps, throws and combined events, each with the right units and
  "lower/higher is better" direction.
- **Charts** — progress over time, best per season, improvement curve, training volume;
  theme-aware and colour-blind-safe.
- **Goals** — set a target per event and watch the gap to your PB close.
- **Workout library (schede)** — structured schemes in the classic coach-table format
  (blocco · ripetute · recupero · pausa · ritmo · note), attachable to sessions as
  immutable snapshots.
- **Two seasons per year** — *estiva* (Apr–Sep) and *invernale* (Oct–Mar).
- **FIDAL import** — paste your athlete profile URL and import official results,
  de-duplicated.
- **Full JSON import/export** — migrating instance is *export → register → import*.
- **REST API** — `/api/v1/*` with per-user API keys.
- **Multi-user** — isolated accounts; one env-managed admin plus self-service users.

## Visuals

**Dashboard** — season overview, goals, latest PBs, progress of your most-raced event
and monthly training volume.

![Dashboard](docs/screenshots/dashboard.png)

**Record** — personal & season bests (wind-legal), goals, and per-event charts.

![Record](docs/screenshots/records.png)

<details>
<summary>More screenshots — sessions & workout library</summary>

**Sessioni** — every training day and competition, filterable.

![Sessioni](docs/screenshots/sessions.png)

**Schede** — the workout library in the coach-table format.

![Schede](docs/screenshots/workouts.png)

</details>

> The screenshots use a demo dataset, not real data.

## Installation

### Requirements

- [Docker](https://docs.docker.com/get-docker/) with Compose (that's all — the app image
  is prebuilt by GitHub Actions and published to GHCR).
- For local development only: Node 22+, pnpm 11.

### Run it

```bash
git clone https://github.com/mmattia09/times.git && cd times
cp .env.example .env
# Edit .env — at minimum:
#   BETTER_AUTH_SECRET  → openssl rand -base64 32
#   ADMIN_EMAIL / ADMIN_PASSWORD → your admin login
docker compose up -d
```

On boot the app container runs the database migrations and provisions the admin
account, then serves at <http://localhost:3000>. Everything runs on an isolated
`times` Docker network; Postgres is reachable from the host only on
`127.0.0.1:5432` (handy for development, remove the mapping in production).

To update: `docker compose pull app && docker compose up -d`. To pin a version,
set `APP_IMAGE=ghcr.io/mmattia09/times:vX.Y.Z` in `.env`.

### Configuration

| Variable               | Purpose                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `DB_PASSWORD`          | Password for the Postgres container.                             |
| `DATABASE_URL`         | Postgres connection string (used by local dev).                  |
| `BETTER_AUTH_SECRET`   | Session-signing secret (`openssl rand -base64 32`).              |
| `BETTER_AUTH_URL`      | Public URL where the app is reachable.                           |
| `ADMIN_EMAIL`          | Admin login email.                                               |
| `ADMIN_PASSWORD`       | Admin login password.                                            |
| `DISABLE_REGISTRATION` | `true` to block new sign-ups once your accounts exist.           |
| `APP_IMAGE`            | Optional: pin the image version to run.                          |

**Accounts.** The admin is the first user, provisioned from `ADMIN_EMAIL` /
`ADMIN_PASSWORD`: edit `.env` and restart to change its credentials (they re-sync on
every boot; the display name is editable in the app). Everyone else registers through
the UI and self-manages name, email and password from **Impostazioni**.

## Usage

1. Log in with the admin credentials and set your **FIDAL profile URL** in
   *Impostazioni → Integrazione FIDAL* to pull in your official results — or start
   logging sessions by hand with **Nuova sessione**.
2. Build your workout library under **Schede** and attach a scheda when logging a
   training session.
3. **Record** shows PBs, season bests and charts; set targets with **Obiettivi**.
4. Your data is yours: *Impostazioni → Dati* exports everything as one JSON file, and
   the import is idempotent (re-importing never duplicates).

Programmatic access — generate a key in *Impostazioni → Chiavi API*:

```bash
curl -H "Authorization: Bearer ath_live_…" https://your-host/api/v1/records
```

| Method & path                     | Description                              |
| --------------------------------- | ---------------------------------------- |
| `GET/POST /api/v1/sessions`       | List / create sessions with performances |
| `GET/PUT/DELETE /api/v1/sessions/:id` | Read / replace / delete a session    |
| `GET /api/v1/performances`        | List performances (`distance,from,to`)   |
| `GET /api/v1/records`             | Personal bests per event                 |
| `GET /api/v1/export` · `POST /api/v1/import` | Full backup / restore         |
| `GET /api/v1/fidal/preview` · `POST /api/v1/fidal/sync` | FIDAL import      |

## Support

Questions and bug reports → [GitHub Issues](https://github.com/mmattia09/times/issues).

## Roadmap

- **PWA / mobile** — installable on the phone, to log times right at the track.
- **English UI (i18n)** — bilingual IT/EN interface.

## Contributing

Issues and pull requests are welcome. To get a dev environment running:

```bash
pnpm install
docker compose up -d db            # Postgres only
cp .env.example apps/web/.env.local
pnpm db:migrate && pnpm db:seed    # migrations + admin provisioning
pnpm dev                           # http://localhost:3000
```

Before opening a PR, please make sure these pass (CI runs the same checks):

```bash
pnpm --filter web lint
pnpm --filter web exec tsc --noEmit
pnpm --filter web build
```

Schema changes go through Drizzle migrations (`pnpm db:generate`), committed with the
change. Keep new UI text in Italian for now (English is on the roadmap).

## Authors and acknowledgment

Made by [@mmattia09](https://github.com/mmattia09). Developed with the help of
[Claude Code](https://claude.com/claude-code).

## License

[MIT](LICENSE).

## Project status

**Stable / maintenance** — the app covers its author's day-to-day needs. Bug fixes and
small improvements land as needed; the roadmap above is best-effort.
