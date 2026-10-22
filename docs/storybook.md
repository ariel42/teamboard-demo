# Storybook

Storybook 10 (react-vite) documents and tests the web client's components. Every component has
stories; the stories double as test fixtures. The in-app page "How we test UI" explains the five
testing approaches and links to the stories that demonstrate them.

## Running it

```sh
npm ci
npm run db:setup      # once: creates and seeds mocks.fixtures
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
| `Compositions/Board`, `Column`, `CardDialog` | Several components together, fed by DB fixtures: typical, empty, long text, RTL, overloaded.    |
| `Layout/AppShell`                            | The app shell at 375, 768 and 1440 px, dark and RTL, mobile menu.                               |
| `Layout/Gallery`                             | Light, dark, dark RTL and light RTL boards on one page.                                         |
| `Pages/BoardPage`                            | The real routes with MSW: loading, empty, error with retry, populated, overloaded, flag combos. |
| `How we test UI`                             | MDX page describing the testing approaches.                                                     |

The toolbar has **Theme** (light, dark) and **Direction** (ltr, rtl) globals that apply to every
story. Viewports are mobile (375), tablet (768) and desktop (1440).

## Where the data comes from

```
Postgres mocks.fixtures --pg--> Vite middleware --zod--> GET /__fixtures/:name --fetch--> story loader
```

- The table `mocks.fixtures(name, description, data jsonb)` is seeded by `npm run db:seed`.
  Fixtures: `typical`, `empty`, `long-text`, `overloaded`, `rtl-hebrew`, `all-priorities`.
- `apps/web/.storybook/fixtures-plugin.ts` is a Vite plugin (registered in `viteFinal`). It reads
  the table with `pg`, validates each row with `boardPayloadSchema` and answers
  `GET /__fixtures` (list) and `GET /__fixtures/:name`.
- A story declares `parameters: { fixture: 'typical' }`. A global loader in
  `.storybook/preview.tsx` calls `loadFixture(name)` (in `src/stories/support/fixtures.ts`) and the
  story receives the board in `loaded.fixture`.
- Page stories use MSW instead: `parameters.mockApi` installs a stateful fake API (moves, new
  cards, comments and flags work) built from the same fixtures.

### Toolbar "Data" switch

The toolbar has a "Data" switch: "Fixtures" (the default) or "Live schema".

- **Fixtures** is everything described above. No extra requests, no polling.
- **Live schema** builds the board of the story's fixture (`typical`, `empty`, ...) from the real
  `sb_app` / `sb_config` tables on every load, through `GET /__fixtures-live/:name`
  (`Cache-Control: no-store`). A green badge "Live: sb_app" shows in the corner of the story. Page
  stories (MSW) get the same live board as their starting data; writes in the fake API stay in the
  browser and never reach `sb_app`.
- **Edit with SQL, see it in the story.** The story reloads by itself (about 2 s) after the data
  changes; it polls `GET /__fixtures-live/:name/version` (an md5 of the payload) and reloads the
  preview when it changes, keeping the toolbar choices. Polling stops when you switch back to
  Fixtures or open another story.

  ```sql
  -- rename the first card of the "typical" scenario
  update sb_app.cards set title = 'Edited in SQL'
   where id = (select min(c.id) from sb_app.cards c
                 join sb_app.columns col on col.id = c.column_id
                where col.board_id = (select (value #>> '{}')::int from sb_config.settings
                                       where key = 'storybook_scenario_typical'));
  ```

- **Reset** your edits with `npm run db:reset-storybook`.
- If `sb_` is not seeded or the database is down, the endpoint answers 503 with a hint
  (`npm run db:seed-storybook`). The story then shows the fixture and the badge turns red with the
  message.
- In the static build the badge says "Live schema needs the dev server" and the fixtures are used.
- Known gaps: the live payload lists every user in `sb_app`, and ids are the real serial ids (not the
  fixture ids).

### The `sb_app` mirror

`sb_app` / `sb_config` are real schemas with the same tables as `app` / `config` (`sb_mocks` is
created by the migration runner and stays empty). They hold the six fixture scenarios as real rows,
one board per scenario, so you can edit a row there and leave the app data alone.

```bash
npm run db:seed-storybook    # migrate sb_ and add any scenario board that is missing
npm run db:reset-storybook   # drop and recreate sb_* only, then reseed (loses your edits)
```

Scenario boards are insert-only: a scenario whose board exists is not touched, so edits survive
reruns. Config rows (flags, settings) follow the `db:seed` rules. The
board of each scenario is recorded in `sb_config.settings` as `storybook_scenario_<name>` (the board
id). `db:setup`, `db:seed` and `db:reset` never touch `sb_*`, and these two commands never touch
`app`, `config` or `mocks`. The prefix is fixed to `sb_`; `DB_SCHEMA_PREFIX` is ignored. Only the tests override it
(`TEAMBOARD_STORYBOOK_PREFIX`, a throwaway `t<hex>_sb_` prefix), so `npm test` never touches your
real `sb_*` rows; reset refuses any other prefix.

### Edit a fixture and see it in the story

```sql
update mocks.fixtures
   set data = jsonb_set(data, '{columns,0,name}', '"Renamed in SQL"')
 where name = 'typical';
```

Reload the story (for example `Compositions/Board`, "Typical"); the first column is renamed. Data
is read on every request, so Storybook does not need a restart. A row that does not match the
schema is rejected with HTTP 422 and a message naming the offending field.

### When the database is unreachable

The endpoint answers 503 with `{ "error": "Cannot reach the database: ..." }`, and every story that
needs a fixture shows an error panel ("This story needs the database") instead of a blank page.
Storybook itself keeps running and stories that use plain props still render. Under the test
runner the same situation throws, so tests fail loudly instead of passing on an error panel.

### Static build

`npm run build-storybook` pre-renders all fixtures (reading the DB at build time) into
`storybook-static/__fixtures.json`, and the client reads that file instead of `/__fixtures/...`.
The built site therefore works from any static host with no database. Fixture changes need a
rebuild. The build fails if `DATABASE_URL` is missing or a fixture is invalid. Live schema mode is not
baked in: it needs the dev server.

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
Fixture-backed stories need the database variables in the environment that started it.

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
