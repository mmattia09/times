# Times

[![CI](https://img.shields.io/github/actions/workflow/status/mmattia09/times/ci.yml?branch=main&label=CI&style=for-the-badge)](https://github.com/mmattia09/times/actions/workflows/ci.yml)
[![Docker image](https://img.shields.io/github/actions/workflow/status/mmattia09/times/docker-image.yml?branch=main&label=docker&style=for-the-badge)](https://github.com/mmattia09/times/actions/workflows/docker-image.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

A self-hosted web app for track & field athletes: log training sessions and
competitions, track personal and season bests, set goals, keep a library of
structured workouts, and visualise your progress — all on your own server.

Built by a sprinter to replace a Notion database; useful for any athletics
discipline. The interface speaks Italian, English, German and Spanish, installs
on a phone as a PWA, and works the same in any time zone.

## Features

- **Sessions & performances** — a training day or a competition, with any number of
  results (e.g. 100m heat + 200m final) — or **none at all**: a session can just record
  the day (or a multi-day period) you trained, optionally with a workout attached.
  Filters by season, type, discipline, level, organiser and indoor/outdoor, plus a
  free-text search over venue and notes.
- **List or calendar** — the same sessions laid out by day, one month at a time, with
  races and training as separate markers and multi-day meets spanning their days.
- **Links on a session** — the Strava activity, the race video, the start list. Strava,
  Instagram, YouTube and TikTok are recognised and drawn with their own mark in the
  app's own colours.
- **Personal & season bests** — recomputed on every write. Wind-aware: a tailwind above
  **+2.0 m/s** flags the mark *ventosa* (kept and charted, but never a record — the
  [FIDAL](https://www.fidal.it) / World Athletics rule).
- **All disciplines first-class** — sprints, hurdles, middle/long distance, relays, race
  walking, jumps, throws and combined events, each with the right units and
  "lower/higher is better" direction.
- **Athletic tests** — standing jumps (lungo/alto/triplo/quintuplo/decuplo da fermo) and
  the Sargent test live in their own **Test** discipline, so they never mix into the
  competition-jump records.
- **Charts** — progress over time, best per season, improvement curve, training volume;
  theme-aware and colour-blind-safe.
- **Goals** — set a target per event and watch the gap to your PB close.
- **Workout library** — structured schemes in the classic coach-table format
  (block · reps · recovery · pause · pace · notes), attachable to sessions as immutable
  snapshots. Each workout shows how many times you have done it and links to those
  sessions (and back).
- **Two seasons per year** — *estiva* (Apr–Sep) and *invernale* (Oct–Mar).
- **FIDAL import** — paste your athlete profile URL and import official results,
  de-duplicated.
- **Full JSON import/export** — migrating instance is *export → register → import*.
- **REST API** — `/api/v1/*` with per-user API keys.
- **Multi-user** — isolated accounts; nobody can see anyone else's training.
- **Admin area** — the owner (and anyone they promote) gets a page listing every user
  with what they have logged and whether they are still signed in, plus the controls to
  create an account, grant or revoke admin, sign someone out of every device, and
  delete a user with all their data.
- **Four languages** — Italian, English, German and Spanish, picked per user in
  Settings (or guessed from the browser on first visit). Event names, seasons and
  dates all follow the choice.
- **Time-zone safe** — a session date is a calendar day: the 24th of May stays the
  24th whether the server runs in Rome, London or UTC. Timestamps (last sync, API-key
  activity) render in your own zone, taken from the browser or set in Settings.
- **Installable (PWA)** — add it to the home screen and log times at the track. With no
  signal the logging page still opens and the session is kept on the phone, then sent
  by itself when the network comes back.
- **Repeat a session** — reopen a past session with its venue, timing, level and
  workout, dated today and with the results blank, ready to fill in.

## Visuals

**Dashboard** — season overview, goals, latest PBs, progress of your most-raced event
and monthly training volume.

![Dashboard](docs/screenshots/dashboard.png)

**Records** — personal & season bests (wind-legal), goals, and per-event charts.

![Records](docs/screenshots/records.png)

<details>
<summary>More screenshots — sessions & workout library</summary>

**Sessions** — every training day and competition, filterable and searchable.

![Sessions](docs/screenshots/sessions.png)

**Workouts** — the library, in the coach-table format.

![Workouts](docs/screenshots/workouts.png)

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
| `BETTER_AUTH_URL`      | Public URL where the app is reachable (see *Behind a proxy*).    |
| `TRUSTED_ORIGINS`      | Extra public names the same instance answers to, comma separated.|
| `SECURE_COOKIES`       | `false` when the app is also opened over plain http on the LAN.  |
| `ADMIN_EMAIL`          | Admin login email.                                               |
| `ADMIN_PASSWORD`       | Admin login password.                                            |
| `DISABLE_REGISTRATION` | `true` to block new sign-ups once your accounts exist.           |
| `APP_IMAGE`            | Optional: pin the image version to run.                          |

**Accounts.** The *owner* is the first user, provisioned from `ADMIN_EMAIL` /
`ADMIN_PASSWORD`: edit `.env` and restart to change its credentials (they re-sync on
every boot; the display name is editable in the app). Because the environment owns that
account, the admin area refuses to demote or delete it.

The owner can grant **admin** to anyone else from **Administration**, which is also
where accounts get created when `DISABLE_REGISTRATION=true` leaves no other way in —
there is no mail server, so the admin sets an initial password and passes it on. That
password can be marked as temporary: until the person replaces it, neither the app nor
the API opens for them. Admins can also reset an existing user's password, on the same
terms — it signs that user out everywhere, and the dialog says plainly that the
password opens their account until they change it.

Everyone else registers through the UI and self-manages name, email, password,
language and time zone from **Settings**.

### Behind a proxy or a tunnel

Set `BETTER_AUTH_URL` to the address you actually type in the browser — a
Cloudflare tunnel hostname, or whatever your reverse proxy serves. Logins are
refused from any origin the app doesn't recognise, which is what stops another
site from driving your session, so this has to be right.

Two things follow from that:

- **Reaching it by LAN address as well.** Private addresses — `192.168.x`,
  `10.x`, `172.16–31.x`, `*.local`, `localhost` — are always accepted, so
  logging in at `http://192.168.1.40:3000` needs no configuration. A second
  *public* name does: list it in `TRUSTED_ORIGINS`.
- **Cookies over plain http.** A session cookie is marked `Secure` when
  `BETTER_AUTH_URL` is https, and browsers drop `Secure` cookies on an http
  page — so the LAN login would appear to succeed and leave you signed out.
  Set `SECURE_COOKIES=false` when you use both. It is the one trade-off here:
  the cookie is then no longer https-only.

The app prints its effective configuration on the first request, so
`docker compose logs app | grep boot` tells you what it thinks it is.

### Logs

Every login, sign-up, password change, and every record the app writes appears
on stdout as one line, with a timestamp and key=value fields:

```
2026-07-31T19:30:51.523Z  auth.signin  user=ma***@example.com  ip=203.0.113.9  origin=https://times.example.com  status=200
2026-07-31T19:31:37.882Z  session.created  user=lWC6l…  id=nTSdA…  date=2026-07-30  type=training  results=1
2026-07-31T19:31:06.638Z  auth.origin.rejected  origin=https://elsewhere.example  trusted=https://times.example.com  hint=…
```

Emails are masked and passwords and tokens are never logged. Follow along with
`docker compose logs -f app`, or pick out one kind with
`docker compose logs app | grep auth.signin`.

## Usage

1. Log in with the admin credentials, pick your language in *Settings → Language*, and
   set your **FIDAL profile URL** under *Settings → FIDAL integration* to pull in your
   official results — or start logging by hand with **New session**.
2. Build your workout library under **Workouts** and attach one when logging a training
   session. Repeating a day you have already logged: open it and press **Repeat**.
3. **Records** shows PBs, season bests and charts; set targets with **Goals**.
4. Your data is yours: *Settings → Data* exports everything as one JSON file, and the
   import is idempotent (re-importing never duplicates).

Programmatic access — generate a key in *Settings → API keys*:

```bash
curl -H "Authorization: Bearer ath_live_…" https://your-host/api/v1/records
```

| Method & path                     | Description                              |
| --------------------------------- | ---------------------------------------- |
| `GET/POST /api/v1/sessions`       | List / create sessions (`performances` may be empty) |
| `GET/PUT/DELETE /api/v1/sessions/:id` | Read / replace / delete a session    |
| `GET /api/v1/performances`        | List performances (`distance,from,to`)   |
| `GET /api/v1/records`             | Personal bests per event                 |
| `GET /api/v1/export` · `POST /api/v1/import` | Full backup / restore         |
| `GET /api/v1/fidal/preview` · `POST /api/v1/fidal/sync` | FIDAL import      |

A rejected write answers `400 {"error":"bad_request","issues":…}`, where each issue is
a stable key such as `validation.dateRequired` — the same key the UI translates, so the
message never changes with the caller's language.

## Support

Questions and bug reports → [GitHub Issues](https://github.com/mmattia09/times/issues).

## Roadmap

- **Offline editing** — changing an existing session still needs the network; only new
  ones are queued.
- **More languages** — the dictionaries are typed against Italian, so adding one is a
  single file under `apps/web/lib/i18n/locales`.

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
pnpm --filter web check    # FIDAL parsing: units, event names, repair rules
pnpm --filter web build
```

Schema changes go through Drizzle migrations (`pnpm db:generate`), committed with the
change. UI text goes through the dictionaries in `apps/web/lib/i18n/locales`: add the
key to `it.ts` first — it is the source of truth the others are typed against, so a
missing translation is a compile error, not a surprise at runtime.

## Authors and acknowledgment

Made by [@mmattia09](https://github.com/mmattia09). Developed with the help of
[Claude Code](https://claude.com/claude-code).

## License

[MIT](LICENSE).

## Project status

**Stable / maintenance** — the app covers its author's day-to-day needs. Bug fixes and
small improvements land as needed; the roadmap above is best-effort.
