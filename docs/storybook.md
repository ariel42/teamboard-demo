# Storybook

Storybook 10 (react-vite) documents and tests the web client's components. Every component has
stories; the stories double as test fixtures. The in-app page "How we test UI" explains the five
testing approaches and links to the stories that demonstrate them.

## Running it

```sh
npm ci
npm run db:setup      # once: migrates and seeds app/config and the sb_ schemas Storybook reads
npm run storybook     # http://localhost:6006 (no browser opened, localhost only, no prompts)
```

`DATABASE_URL` (and the optional `DB_SCHEMA_PREFIX`) must be set, as for the rest of the repo. The
server accepts any Host header (`allowedHosts: true`) so it works behind Coder, Dev Containers
and port forwarding.

`npm run build-storybook` writes a static site to `apps/web/storybook-static`. It does not need a
database to be served (see "Static build").

## What the stories cover

| Title                                        | Contents                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Components/*` (14 components)               | Single components with plain props: every state and variant, plus play tests for interactions.  |
| `Compositions/Board`, `Column`, `CardDialog` | Several components together, fed by `sb_` data: typical, empty, long text, RTL, overloaded.     |
| `Layout/AppShell`                            | The app shell at 375, 768 and 1440 px, dark and RTL, mobile menu.                               |
| `Layout/Gallery`                             | Light, dark, dark RTL and light RTL boards on one page.                                         |
| `Pages/BoardPage`                            | The real routes with MSW: loading, empty, error with retry, populated, overloaded, flag combos. |
| `How we test UI`                             | MDX page describing the testing approaches.                                                     |

The toolbar has **Theme** (light, dark) and **Direction** (ltr, rtl) globals that apply to every
story. Viewports are mobile (375), tablet (768) and desktop (1440).

## Where the data comes from

One source: the `sb_app` / `sb_config` schemas. They have the same tables as `app` / `config` and
hold six scenarios (`typical`, `empty`, `overloaded`, `long-text`, `rtl-hebrew`, `all-priorities`),
one board each. Nothing else feeds the stories.

```
Postgres sb_app/sb_config --pg--> Vite middleware --zod--> GET /__fixtures/:name --fetch--> story loader
```

- `apps/web/.storybook/fixtures-plugin.ts` is a Vite plugin (registered in `viteFinal`). It builds
  the board of a scenario from the `sb_` tables on every request, validates it with
  `boardPayloadSchema` and answers `GET /__fixtures/:name` (`Cache-Control: no-store`) and
  `GET /__fixtures/:name/version` (an md5 of the payload).
- A story declares `parameters: { fixture: 'typical' }`. A global loader in `.storybook/preview.tsx`
  calls `loadFixture(name)` (in `src/stories/support/fixtures.ts`) and the story receives the board
  in `loaded.fixture`.
- Page stories use MSW instead: `parameters.mockApi` installs a stateful fake API (moves, new
  cards, comments and flags work) that starts from the same board. Writes stay in the browser and
  never reach `sb_app`.

### Edit with SQL, see it in the story

```sql
-- rename the first card of the "typical" scenario
update sb_app.cards set title = 'Edited in SQL'
 where id = (select min(c.id) from sb_app.cards c
               join sb_app.columns col on col.id = c.column_id
              where col.board_id = (select (value #>> '{}')::int from sb_config.settings
                                     where key = 'storybook_scenario_typical'));
```

In the dev server the story reloads by itself (about 2 s): it polls `/__fixtures/:name/version` and
reloads the preview when the hash changes, keeping the toolbar choices (theme, direction). Polling
stops when you open another story, pauses while the tab is hidden, and gives up after 5 failed polls in a
row (404, 503, server down); reload the story to start it again. Reset your edits with `npm run db:reset-storybook`.

### The `sb_` schemas

```bash
npm run db:seed-storybook    # migrate sb_ and add any scenario board that is missing
npm run db:reset-storybook   # drop and recreate sb_* only, then reseed (loses your edits)
```

Every board and column name in `sb_app` carries a visible "mock" marker so the rows are never
mistaken for real app data: boards get ` · mock` ("Sprint 24 · mock"), columns ` (mock)` ("To do
(mock)"). The Hebrew scenario uses the same Latin marker ("ספרינט 24 · mock", "לביצוע (mock)").

Scenario boards are insert-only: a scenario whose board exists is not touched, so edits survive
reruns. The board of each scenario is recorded in `sb_config.settings` as
`storybook_scenario_<name>`. `db:setup` ends with the same insert-only seed. `db:seed` and
`db:reset` never touch `sb_*`, and the two commands above never touch `app` or `config`. The prefix
is fixed to `sb_`; `DB_SCHEMA_PREFIX` is ignored, so a prefixed `db:setup` still seeds the real
`sb_*` (insert-only), and a failure of that step fails `db:setup`. Only the tests override it
(`TEAMBOARD_STORYBOOK_PREFIX`, a throwaway `t<hex>_sb_` prefix), so `npm test` never touches your
real `sb_*` rows; reset refuses any other prefix, including a bare `t<hex8>_` app-test prefix.

Known gap: the payload lists every user in `sb_app`, and ids are the real serial ids.

### When `sb_` is missing or the database is unreachable

The endpoint answers 503 with a message (`Run "npm run db:setup" to create and fill the sb_
schemas.`, or `Cannot reach the database: ...`), and every story that needs data shows one error
panel with that hint instead of a blank page. The preview keeps polling: once `sb_` is seeded, the
story recovers by itself. Storybook keeps running and stories with plain props still render. Under
the test runner the same situation throws, so tests fail loudly.

### Static build

`npm run build-storybook` reads the six scenarios from `sb_` at build time and writes them to
`storybook-static/__fixtures.json`; the client reads that file instead of `/__fixtures/...`. The
built site needs no database, no auto-refresh, and a data change needs a rebuild. The build fails if
`DATABASE_URL` is missing or `sb_` is not seeded (run `npm run db:setup` first; CI does).

### Going back to fixtures-main

The git tag `fixtures-main` is the last version where Storybook read JSON fixtures from
`mocks.fixtures`. Migration `002_drop_mocks.sql` drops that table, so the old code cannot run on a
database that has applied it. To go back:

```sh
npm run db:restore-fixtures   # on this branch: recreates an empty mocks.fixtures, forgets 002
git switch --detach fixtures-main   # or: git checkout -b old-fixtures fixtures-main
npm ci && npm run db:setup    # the old seed refills mocks.fixtures; app data is untouched
```

The restore must run once per environment and database (each dev DB, the Dev Container's, CI): it
recreates an empty `mocks.fixtures`, and the old `db:setup` then refills it.

If you checked out `fixtures-main` before restoring (the old `db:setup` then fails on the missing
`mocks.fixtures`), recover like this: switch back to `storybook-live-data` (or main), run
`npm run db:restore-fixtures`, then switch to `fixtures-main` again and run `npm ci && npm run db:setup`.

`sb_*` stays in the database and the old code ignores it. To come back to the new version, check
out the branch (or main after the merge) and run `npm run db:setup`: it applies 002 again. Proven
on a throwaway prefix: 6 fixtures back after the round trip, `app` rows unchanged.

## Tests

| Command           | What it runs                                                                 |
| ----------------- | ---------------------------------------------------------------------------- |
| `npm run test:ui` | Every story as a Vitest browser test (headless Chromium): render, play, axe. |
| `npm test`        | Fast, browser-free unit tests, including portable-stories tests (jsdom).     |

`test:ui` works from the repo root and from `apps/web`. It needs Postgres with `db:setup` done and
Chromium: `npx playwright install --with-deps chromium` (see
[browser-prerequisites.md](browser-prerequisites.md)). Accessibility violations fail the run
(`parameters.a11y.test = 'error'`); the three documented waivers are listed on "How we test UI".

## VS Code Story Explorer

The recommended extension `joshbolduc.story-explorer` lists the stories from the Storybook it finds or
starts itself (it runs `npm run storybook` and reads the port with `lsof`, so `lsof` must be installed).
Stories that need data need the database variables in the environment that started it.

- The script uses `--ci` so Storybook never waits for input (a prompt in the extension's hidden task
  terminal looks like an endless "Loading"), and no `--host`, so it listens on localhost only.
  `.storybook/main.ts` keeps Storybook's host validation on and accepts `localhost`, `127.0.0.1`,
  `*.yair.link` (the Coder app hosts) and anything in `STORYBOOK_ALLOWED_HOSTS` (comma separated).
- If a Storybook is already running on 6006, the extension's own launch takes the next free port.
- **Browser-based VS Code (code-server on Coder): the in-editor preview works through a patch.** Unpatched, the
  extension loads its preview from `http://localhost:<port>`, which in a browser is the developer's own PC.
  The Coder image therefore patches the extension (`coder/image/patch-story-explorer.mjs` in the `dev-env`
  repo): it asks VS Code for the externally reachable address, which code-server turns into the Coder port URL
  (`<port>--main--<workspace>--<user>--coder.yair.link`, owner only). Storybook must allow being embedded from
  there: `.storybook/main.ts` sets `security.insecureRemoteIframeEmbed` and `insecureIframeMessaging` when
  `DEVENV_KIND` is set (mise, Dev Containers and Coder: all hosts of the editor preview; Storybook checks every ancestor frame, and a VS Code webview is never on localhost), and not in a plain `npm run storybook` elsewhere. Open a preview with the **Preview Story** code lens above a
  story. Desktop VS Code (also Remote-SSH and Dev Containers) needs no extension patch, only that Storybook setting.
  - The extension's auto-update is off in Coder (an updated copy would lose the patch); the image build fails
    if a new extension version no longer matches the patch.
  - "Open Storybook in Browser" (globe icon) and the **Storybook** button of the workspace still work.
  - VS Code's Simple Browser shows the same page once Storybook allows embedding.
- If the extension's own launch fails, open the task terminal "npm run storybook" and look for a prompt or
  an error (the script uses `--ci` so there is no prompt).
