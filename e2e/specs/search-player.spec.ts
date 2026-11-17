import {
  closeNowPlaying,
  expect,
  gotoLibrary,
  openNowPlaying,
  openSearch,
  searchResult,
  test,
  trackButton,
} from '../fixtures/app';

test.describe('Search and player', () => {
  test.beforeEach(async ({ page }) => {
    await gotoLibrary(page);
  });

  test('search opens focused, filters, and closes back to the library', async ({ page }) => {
    const input = await openSearch(page);
    await expect(page.getByText('Search your library', { exact: true })).toBeVisible();

    await input.fill('night bus');
    await expect(searchResult(page, 'Night Bus Home')).toBeVisible();
    await expect(searchResult(page, 'Neon Orchard')).toHaveCount(0);

    await input.fill('no such song');
    await expect(page.getByText('No matches', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Close search', exact: true }).click();
    await expect(trackButton(page, 'Neon Orchard')).toBeVisible();
  });

  test('selecting a result opens Now Playing and playback advances', async ({ page }) => {
    const input = await openSearch(page);
    await input.fill('night bus');
    await searchResult(page, 'Night Bus Home').click();

    await expect(
      page.getByRole('button', { name: 'Add Night Bus Home to Liked Songs', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

    const seek = page.getByRole('slider', { name: 'Seek', exact: true });
    await expect(seek).toBeVisible();
    // react-native-web does not emit aria-valuenow here, so watch the visible
    // position readout advance from 0:00 instead of the slider attribute.
    await expect
      .poll(async () => page.getByText(/^0:0[1-9]$/).count())
      .toBeGreaterThan(0);
  });

  test('play/pause toggles and the mini player expands and closes', async ({ page }) => {
    await openNowPlaying(page, 'Neon Orchard');

    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

    await closeNowPlaying(page);
    await expect(page.getByRole('button', { name: 'Open now playing', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close player', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Open now playing', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();

    await closeNowPlaying(page);
    await page.getByRole('button', { name: 'Close player', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open now playing', exact: true })).toHaveCount(0);
  });

  test('sleep timer opens and closes without leaving the player', async ({ page }) => {
    await openNowPlaying(page, 'Neon Orchard');

    await page.getByRole('button', { name: 'Sleep timer', exact: true }).click();
    await page.getByRole('button', { name: 'Sleep in 15 minutes', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Sleep timer, / })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
  });
});
