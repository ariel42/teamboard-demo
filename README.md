# Teamboard

Teamboard is a small Kanban board (boards, columns, cards, comments, feature flags). It is the demo
workload used to compare developer environments (mise, Dev Containers, Coder): the app is
deliberately ordinary, so differences between environments are the interesting part.

This repository currently contains the database package and the API. The web UI and Storybook are
added separately.

## Quick start

```sh
npm ci
npm run db:setup   # migrate + seed (safe to re-run)
npm run dev        # API on http://localhost:3000
```

No env files and no connection strings live in this repo. The environment must provide the
variables below. `npm run doctor` tells you what is missing.

## Environment contract

| Variable           | Required | Meaning                                                                |
| ------------------ | -------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`     | yes      | Postgres connection string. The only connection setting the app reads. |
| `DEVENV_KIND`      | no       | Which environment this is (`mise`, `devcontainer`, `coder`, ...).      |
| `DEVENV_USER`      | no       | Who is using it. Both are shown by `doctor` and `GET /api/config`.     |
| `PORT`             | no       | API port, default `3000`. Listens on `0.0.0.0`.                        |
| `DB_SCHEMA_PREFIX` | no       | Prefix for the schema names (default empty). Tests use a random one.   |

Default ports: web 5173, API 3000, Storybook 6006.

Requirements: Node 24 (`engines` is `>=24 <25`, `engine-strict=true`). There is deliberately no
`mise.toml` or `.nvmrc`; the environment brings Node.

## Scripts (run from the repo root)

| Script               | What it does                                                                      |
| -------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`        | Runs every `dev:*` script with concurrently (today only `dev:api`).               |
| `npm run dev:api`    | API with `tsx watch` (same as `npm run dev -w apps/api`).                         |
| `npm run db:migrate` | Applies pending SQL migrations.                                                   |
| `npm run db:seed`    | Seeds config, mock fixtures and the "Sprint 24" starter board. Idempotent.        |
| `npm run db:setup`   | `db:migrate` then `db:seed`.                                                      |
| `npm run db:reset`   | Drops the `app`, `config` and `mocks` schemas, then runs `db:setup`.              |
| `npm test`           | Unit and API integration tests (vitest, real Postgres, no browser).               |
| `npm run lint`       | ESLint and `prettier --check`.                                                    |
| `npm run format`     | `prettier --write`.                                                               |
| `npm run typecheck`  | `tsc --noEmit` in every workspace.                                                |
| `npm run doctor`     | Checks Node version, `DATABASE_URL`, DB reachability, migrations, and free ports. |

To add the web app later: create the workspace with a `dev` script and add a root `dev:web`
script; `npm run dev` picks up every `dev:*` script automatically.

`npm run doctor` exits non-zero when a check fails and prints a short fix hint. It expects ports
5173, 3000 and 6006 to be free, so run it before starting the dev servers.

## Layout

```
apps/api            Fastify API (src/, test/)
packages/db         migrations, seed, repository, shared types, createPool()
scripts/doctor.mjs  environment check
```

`@teamboard/db` exports the shared types (`BoardPayload` is the response of
`GET /api/boards/:id`), zod schemas for them (`@teamboard/db/schemas`), `createPool()`, the
repository and a test helper (`@teamboard/db/testing`).

## Database

Three schemas, each named `${DB_SCHEMA_PREFIX}<name>`:

| Schema   | Tables                                                                                  |
| -------- | --------------------------------------------------------------------------------------- |
| `app`    | `users`, `boards`, `columns`, `cards`, `comments`, `migrations` (applied-migration log) |
| `config` | `feature_flags` (key, enabled, description), `settings` (key, JSON value)               |
| `mocks`  | `fixtures` (name, JSON board payload)                                                   |

Migrations are plain SQL files in `packages/db/migrations/`, written with `{{app}}`, `{{config}}`
and `{{mocks}}` placeholders for the schema names. The runner applies each file once, in order,
inside a transaction, and records it in `<prefix>app.migrations`.

Seeded feature flags: `card_comments` (on), `due_dates` (on), `wip_limits` (off), `compact_cards`
(off). Settings include `wip_limit` = 5. Fixtures: `typical`, `empty`, `overloaded`, `long-text`,
`rtl-hebrew`, `all-priorities` (deterministic, no randomness at runtime). The seed never overwrites
cards, flags or settings a developer changed.

Cards have dense zero-based positions per column; moving a card keeps both columns consistent.

## API

JSON in, JSON out. Errors look like `{ "error": "validation_error", "message": "...", "details": [...] }`
with status 400 (bad input), 404 (missing), 422 (unknown referenced id) or 500. CORS reflects the
request origin.

| Method and path                | Description                                                           |
| ------------------------------ | --------------------------------------------------------------------- |
| `GET /api/health`              | `{ status, db }`; 503 if the database is down.                        |
| `GET /api/config`              | `{ flags, settings, env: { kind, user } }`.                           |
| `PATCH /api/config/flags/:key` | Body `{ enabled }`; toggles a feature flag.                           |
| `GET /api/boards`              | Board summaries with card counts.                                     |
| `GET /api/boards/:id`          | Board payload: board, users, columns with cards (assignee, comments). |
| `POST /api/cards`              | Create a card (`columnId`, `title`, optional fields, `position`).     |
| `PATCH /api/cards/:id`         | Edit fields and/or move (`columnId`, `position`).                     |
| `DELETE /api/cards/:id`        | Delete a card; 204.                                                   |
| `GET /api/cards/:id/comments`  | Comments with authors, oldest first.                                  |
| `POST /api/cards/:id/comments` | Body `{ authorId, body }`.                                            |
| `GET /api/users`               | The team.                                                             |

## Tests and CI

Tests run against the real Postgres in `DATABASE_URL`. Each test file creates a throwaway schema
prefix (for example `t1a2b3c4_app`) and drops it with `CASCADE` afterwards. `.github/workflows/ci.yml`
runs lint, typecheck, `db:setup` and the tests on Node 24 with a `postgres:16` service.
