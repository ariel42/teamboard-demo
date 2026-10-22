# Teamboard

Teamboard is a small Kanban board (boards, columns, cards, comments, feature flags). It is the demo
workload used to compare developer environments (mise, Dev Containers, Coder): the app is
deliberately ordinary, so differences between environments are the interesting part.

The repository contains the database package, the API, the React web client and its Storybook.

## Quick start

```sh
npm ci
npm run db:setup   # migrate + seed + Storybook mirror sb_* (safe to re-run)
npm run dev        # API on http://localhost:3000, web on http://localhost:5173
```

Open http://localhost:5173. Vite proxies `/api` to the API, so the browser only ever uses
relative `/api` URLs. Add `?dir=rtl` to the URL (or set `data-dir="rtl"` on `<html>`) for RTL.

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

Default ports: web 5173, API 3000, Storybook 6006. If 5173 or 3000 is taken, `WEB_PORT` and
`API_PORT` override them for the web dev server and the e2e run (the API itself reads `PORT`).

Requirements: Node 24 (`engines` is `>=24 <25`, `engine-strict=true`). There is deliberately no
`mise.toml` or `.nvmrc`; the environment brings Node.

## Scripts (run from the repo root)

| Script                    | What it does                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `npm run dev`             | Runs every `dev:*` script with concurrently: the API and the web client.             |
| `npm run dev:api`         | API with `tsx watch` (same as `npm run dev -w @teamboard/api`).                      |
| `npm run dev:web`         | Vite dev server on 5173 with the `/api` proxy.                                       |
| `npm run build`           | Type-checks and builds every workspace that has a build (the web client).            |
| `npm test`                | Unit, component and API integration tests (vitest; the API tests use real Postgres). |
| `npm run storybook`       | Storybook on http://localhost:6006 (needs `DATABASE_URL`), see "Storybook".          |
| `npm run build-storybook` | Static Storybook in `apps/web/storybook-static`.                                     |
| `npm run test:ui`         | Every story as a browser test (play functions and axe), see "Storybook".             |
| `npm run test:e2e`        | Playwright against the real stack, see "Tests and CI".                               |
| `npm run db:migrate`      | Applies pending SQL migrations.                                                      |
| `npm run db:seed`         | Seeds config, mock fixtures and the "Sprint 24" starter board. Idempotent.           |
| `npm run db:setup`        | `db:migrate`, `db:seed`, then the insert-only `sb_*` mirror seed (Storybook Live).   |
| `npm run db:reset`        | Drops the `app`, `config` and `mocks` schemas, then runs `db:setup`.                 |
| `npm run lint`            | ESLint and `prettier --check`.                                                       |
| `npm run format`          | `prettier --write`.                                                                  |
| `npm run typecheck`       | `tsc --noEmit` in every workspace.                                                   |
| `npm run doctor`          | Checks Node version, `DATABASE_URL`, DB reachability, migrations, and free ports.    |

`npm run doctor` exits non-zero when a check fails and prints a short fix hint. It expects ports
5173, 3000 and 6006 to be free, so run it before starting the dev servers.

## Layout

```
apps/api            Fastify API (src/, test/)
apps/web            React web client (src/, e2e/)
packages/db         migrations, seed, repository, shared types, createPool()
scripts/doctor.mjs  environment check
```

`@teamboard/db` exports the shared types (`BoardPayload` is the response of
`GET /api/boards/:id`), zod schemas for them (`@teamboard/db/schemas`), `createPool()`, the
repository and a test helper (`@teamboard/db/testing`).

## Web client (apps/web)

Vite 8, React 19, TypeScript, TanStack Query, @dnd-kit, lucide-react.

- Components in `src/components/<Name>/` are purely presentational (props in, callbacks out, one
  CSS file each, `tb-` class names, no fetching), so Storybook can render them with plain props.
- Data fetching and mutations live only in pages (`src/pages`) and hooks (`src/hooks`); the card
  move is optimistic with rollback, then a refetch.
- Styling uses design tokens (`src/styles/tokens.css`), one indigo accent, light/dark/system
  themes, logical CSS properties (RTL via `?dir=rtl` or `data-dir`) and `prefers-reduced-motion`.
- Feature flags (`card_comments`, `due_dates`, `wip_limits`, `compact_cards`) come from
  `/api/config` and can be toggled from the Flags panel; the env chip shows `DEVENV_KIND` and
  `DEVENV_USER`.
- Pages: `BoardPage` (`/boards/:id`) and `BoardListRedirect` (`/`, opens the first board).

Components: `AppShell`, `Avatar`, `Board`, `Button`, `CardDialog`, `Column`, `Comment`,
`CommentForm`, `CommentList`, `DueDate`, `EnvChip`, `FeatureFlagsPanel`, `Label`, `PriorityBadge`,
`Skeleton`, `StateMessage`, `TaskCard`, `ThemeToggle`.

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

## Storybook

```sh
npm run db:setup     # once, seeds mocks.fixtures
npm run storybook    # http://localhost:6006
```

Stories live next to the components (`apps/web/src/components/*/*.stories.tsx`) and under
`apps/web/src/stories` (layout, pages, the "How we test UI" page). They cover single components,
compositions (Board, Column, CardDialog), the app shell at 375/768/1440 px, a light/dark/RTL
gallery, and the board page with MSW (loading, empty, error with retry, populated, overloaded and
feature-flag combinations). The toolbar switches theme and text direction.

**Fixtures come from the database.** The Storybook dev server reads `mocks.fixtures` with `pg`,
validates the rows and serves them at `/__fixtures/:name`. To change a story, edit the row and
reload:

```sql
update mocks.fixtures set data = jsonb_set(data, '{columns,0,name}', '"Hello"') where name = 'typical';
```

If the database is unreachable the stories show an error panel and Storybook keeps running.
`npm run build-storybook` bakes the fixtures into `__fixtures.json`, so the static site needs no
database.

Tests: `npm run test:ui` (every story, play functions and axe in headless Chromium; needs
`npx playwright install chromium`) and `npm test` (includes the portable-stories unit test,
no browser). CI runs `test:ui` in the `storybook` job.

VS Code Story Explorer: it needs `npm run storybook` running so that
`http://localhost:6006/index.json` is served.

Details: [docs/storybook.md](docs/storybook.md).

## Tests and CI

`npm test` runs against the real Postgres in `DATABASE_URL`. Each API/db test file creates a
throwaway schema prefix (for example `t1a2b3c4_app`) and drops it with `CASCADE` afterwards.

`npm run test:e2e` starts the real API and Vite (Playwright `webServer`), against a fresh schema set
`e2e_<random>_{app,config,mocks}` that is migrated, seeded and dropped again at the end, with
`DEVENV_KIND=e2e` and `DEVENV_USER=playwright`. It covers: seeded board, create card, keyboard
and mouse moves (persistence checked in SQL), comments, flag toggle, env chip, RTL overflow and
axe (light and dark). Browser setup: [docs/browser-prerequisites.md](docs/browser-prerequisites.md).

`.github/workflows/ci.yml` has three jobs on Node 24 with a `postgres:16` service: `check` (lint,
typecheck, `db:setup`, build, test), `e2e` (Chromium with deps, `test:e2e`, report artifact) and
`storybook` (`db:setup`, Chromium with deps, `test:ui`, `build-storybook`).
VS Code: `.vscode/` has launch configs, tasks (dev, tests) and recommended extensions.
