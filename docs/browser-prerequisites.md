# Browser prerequisites for the e2e tests

`npm run test:e2e` drives Chromium through Playwright (`@playwright/test` 1.64).

## Browser binary

```sh
npx playwright install chromium          # downloads to ~/.cache/ms-playwright (no root needed)
```

On a clean Linux CI runner or a minimal container also install the OS libraries (needs root):

```sh
sudo npx playwright install-deps chromium
```

CI does exactly that (`npx playwright install --with-deps chromium`).

## What is actually required

On the Ubuntu 24.04 host this app was built on, `npx playwright install-deps --dry-run chromium`
lists 19 missing apt packages:

`fonts-freefont-ttf fonts-ipafont-gothic fonts-noto-color-emoji fonts-tlwg-loma-otf fonts-unifont
fonts-wqy-zenhei libegl-mesa0 libgbm1 libgl1-mesa-dri libglx-mesa0 libpciaccess0 mesa-libgallium
mesa-va-drivers mesa-vdpau-drivers mesa-vulkan-drivers xfonts-cyrillic xserver-common
xserver-xorg-core xvfb`

None of them were installed, and the whole e2e suite (including screenshots and axe) passes: headless
Chromium (`chromium_headless_shell`) only needs libraries that a typical Ubuntu server already has.
The list is the superset Playwright wants for headed mode (`xvfb`, Mesa drivers) and extra fonts.

Consequences:

- Run `install-deps` only if Chromium fails to start with a "shared library" error, or if you want
  full font coverage (emoji and CJK glyphs in screenshots come from the `fonts-*` packages).
- Without the fonts, emoji and CJK text in the stress-test fixtures render as empty boxes in
  screenshots; layout and the assertions are unaffected.
- A distro without the base libraries (a bare container image) does need `install-deps`.

## Ports

The e2e config starts its own API (3000) and Vite (5173) and refuses to reuse running servers. If
those ports are taken on your machine, override them: `WEB_PORT=5181 API_PORT=3001 npm run test:e2e`.
