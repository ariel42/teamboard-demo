import { expect, test, type Page } from '@playwright/test';
import { sql } from './db';

const BOARD = 'Sprint 24';

const column = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const cardsIn = (page: Page, name: string) => column(page, name).getByTestId('task-card');

async function openBoard(page: Page, query = '') {
  await page.goto(`/${query}`);
  await expect(page.getByRole('heading', { level: 1, name: BOARD })).toBeVisible();
}

const columnOf = async (title: string) =>
  (
    await sql<{ column: string; position: number }>(
      `select c.name as column, k.position from {{app}}.cards k
         join {{app}}.columns c on c.id = k.column_id where k.title = $1`,
      [title],
    )
  ).at(0);

test.describe('board', () => {
  test('loads the seeded board with its columns and cards', async ({ page }) => {
    await openBoard(page);
    for (const name of ['Backlog', 'In Progress', 'Review', 'Done']) {
      await expect(column(page, name)).toBeVisible();
    }
    await expect(cardsIn(page, 'Backlog').first()).toContainText('Add Apple Pay to checkout');
    const [row] = await sql<{ count: string }>(
      `select count(*) from {{app}}.cards k join {{app}}.columns c on c.id = k.column_id
         join {{app}}.boards b on b.id = c.board_id where b.name = $1`,
      [BOARD],
    );
    await expect(page.getByTestId('task-card')).toHaveCount(Number(row?.count));
  });

  test('shows the environment values in the env chip', async ({ page }) => {
    await openBoard(page);
    const chip = page.getByTestId('env-chip');
    await expect(chip).toContainText('e2e');
    await expect(chip).toContainText('playwright');
    await expect(chip).toHaveAttribute('data-kind', 'e2e');
  });

  test('creates a card that survives a reload and is stored in Postgres', async ({ page }) => {
    const title = `E2E created card ${Date.now()}`;
    await openBoard(page);
    const backlog = column(page, 'Backlog');
    await backlog.getByRole('button', { name: 'Add card' }).click();
    await backlog.getByLabel('Card title').fill(title);
    await backlog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(cardsIn(page, 'Backlog').filter({ hasText: title })).toBeVisible();

    await page.reload();
    await expect(cardsIn(page, 'Backlog').filter({ hasText: title })).toBeVisible();
    expect(await columnOf(title)).toMatchObject({ column: 'Backlog' });
  });

  test('moves a card with the keyboard and the position persists', async ({ page }) => {
    const title = 'Add Apple Pay to checkout';
    await openBoard(page);
    const card = cardsIn(page, 'Backlog').filter({ hasText: title });
    await card.focus();
    // Each step waits for dnd-kit's live-region announcement, so keys never outrun its measuring.
    const live = page.locator('[role="status"][aria-live="assertive"]');
    await page.keyboard.press('Space');
    await expect(live).toContainText(`card ${title} is now in column Backlog`);
    // dnd-kit's sortable coordinate getter needs a second ArrowRight to leave the source column
    // (the first only nudges the card over its own column), so press until the target is reached.
    await expect(async () => {
      await page.keyboard.press('ArrowRight');
      await expect(live).toContainText(`card ${title} is now in column In Progress`, {
        timeout: 800,
      });
    }).toPass({ timeout: 6_000 });
    await page.keyboard.press('Space');
    await expect(live).toContainText(`Dropped card ${title} in column In Progress`);

    await expect(cardsIn(page, 'In Progress').filter({ hasText: title })).toBeVisible();
    await expect.poll(async () => (await columnOf(title))?.column).toBe('In Progress');

    await page.reload();
    await expect(cardsIn(page, 'In Progress').filter({ hasText: title })).toBeVisible();
    await expect(cardsIn(page, 'Backlog').filter({ hasText: title })).toHaveCount(0);
    expect((await columnOf(title))?.column).toBe('In Progress');
  });

  test('moves a card with the mouse and the position persists', async ({ page }) => {
    const title = 'Export board as CSV';
    await openBoard(page);
    const card = cardsIn(page, 'Backlog').filter({ hasText: title });
    const target = column(page, 'Done');
    const from = (await card.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    // dnd-kit's pointer sensor needs a few intermediate moves to pass its activation distance.
    await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 20, {
      steps: 5,
    });
    await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 20 });
    await page.mouse.up();

    await expect(cardsIn(page, 'Done').filter({ hasText: title })).toBeVisible();
    await expect.poll(async () => (await columnOf(title))?.column).toBe('Done');
    await page.reload();
    await expect(cardsIn(page, 'Done').filter({ hasText: title })).toBeVisible();
  });

  test('adds a comment from the card dialog', async ({ page }) => {
    const body = `E2E comment ${Date.now()}`;
    await openBoard(page);
    await cardsIn(page, 'Review').first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Add a comment/).fill(body);
    await dialog.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(dialog.getByRole('list', { name: 'Comments' })).toContainText(body);

    const rows = await sql(`select 1 from {{app}}.comments where body = $1`, [body]);
    expect(rows).toHaveLength(1);
  });

  test('toggling a feature flag changes the UI and is persisted', async ({ page }) => {
    await openBoard(page);
    await expect(page.locator('.tb-card--compact')).toHaveCount(0);
    await page.getByRole('button', { name: 'Flags' }).click();
    const toggle = page.getByRole('switch', { name: /Compact cards/ });
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect(toggle).toBeChecked();
    await expect(page.locator('.tb-card--compact').first()).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await sql<{ enabled: boolean }>(
              `select enabled from {{config}}.feature_flags where key = 'compact_cards'`,
            )
          )[0]?.enabled,
      )
      .toBe(true);

    await page.reload();
    await expect(page.locator('.tb-card--compact').first()).toBeVisible();
    await page.getByRole('button', { name: 'Flags' }).click();
    await page.getByRole('switch', { name: /Compact cards/ }).click();
    await expect(page.locator('.tb-card--compact')).toHaveCount(0);
  });

  test('RTL layout does not overflow horizontally', async ({ page }) => {
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/?dir=rtl');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(0);
    }
  });
});
