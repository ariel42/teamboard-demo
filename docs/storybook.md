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
rebuild. The build fails if `DATABASE_URL` is missing or a fixture is invalid.

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
