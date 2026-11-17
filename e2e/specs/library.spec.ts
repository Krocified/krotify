import { expect, gotoLibrary, test, trackButton } from '../fixtures/app';

test.describe('Library', () => {
  test.beforeEach(async ({ page }) => {
    await gotoLibrary(page);
  });

  test('loads the demo library without the removed home sections', async ({ page }) => {
    await expect(trackButton(page, 'Neon Orchard')).toBeVisible();
    await expect(trackButton(page, 'Midnight Static')).toBeVisible();
    await expect(trackButton(page, 'Night Bus Home')).toBeVisible();

    await expect(page.getByText('Recently played', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Liked Songs', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Playlists', { exact: true })).toHaveCount(0);
  });

  test('hides the tag filter bar when no tag has an active track', async ({ page }) => {
    // Expo web has no SQLite, so the tag repo returns no tags and the bar must
    // stay out of the layout. Device builds with tags cover the populated bar.
    await expect(page.getByRole('button', { name: 'Show all tracks', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Filter by / })).toHaveCount(0);
  });

  test('rows show artist · duration and the ellipsis affordance', async ({ page }) => {
    await expect(page.getByText('Mira Vale · 4:49', { exact: true })).toBeVisible();
    await expect(page.getByText('Kite Season · 4:01', { exact: true })).toBeVisible();

    const more = page.getByRole('button', { name: 'More options for Neon Orchard', exact: true });
    await expect(more).toBeVisible();
    await expect(page.getByRole('button', { name: 'Neon Orchard Mira Vale · 4:49' })).toHaveAttribute(
      'aria-label',
      'Neon Orchard Mira Vale · 4:49',
    );

    // Current app behavior: demo tracks are read-only on web because
    // AppShell.handleManage() returns before opening the action sheet.
    await more.click();
    await expect(page.getByRole('button', { name: 'Details', exact: true })).toHaveCount(0);
  });

  // Device-only gap: the track action sheet is only reachable for scanned or
  // imported tracks. The web build is always the read-only demo library, so
  // this cannot be exercised in Playwright without faking a native library.
  test.skip('ellipsis opens the track action sheet for device tracks', async ({ page }) => {
    await page.getByRole('button', { name: 'More options for Neon Orchard', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Details', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tags', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save to playlist', exact: true })).toBeVisible();
  });
});
