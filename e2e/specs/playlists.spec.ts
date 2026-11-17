import { expect, gotoLibrary, openNowPlaying, openPlaylists, test } from '../fixtures/app';

test.describe('Playlists', () => {
  test.beforeEach(async ({ page }) => {
    await gotoLibrary(page);
  });

  test('Collections > Playlists creates a playlist and shows a grid card', async ({ page }) => {
    await openPlaylists(page);
    await expect(
      page.getByText('No playlists yet. Create one above to collect tracks.', { exact: true }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'New playlist', exact: true }).click();
    await expect(page.getByPlaceholder('Playlist name', { exact: true })).toBeVisible();
    await page.getByPlaceholder('Playlist name', { exact: true }).fill('Road Trip');
    await page.getByRole('button', { name: 'Create playlist', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Open Road Trip', exact: true })).toBeVisible();
    await expect(page.getByText('Road Trip', { exact: true })).toBeVisible();
    await expect(page.getByText('0 songs', { exact: true })).toBeVisible();
  });

  test('the playlist overflow menu opens edit and delete actions', async ({ page }) => {
    await openPlaylists(page);
    await page.getByRole('button', { name: 'New playlist', exact: true }).click();
    await page.getByPlaceholder('Playlist name', { exact: true }).fill('Road Trip');
    await page.getByRole('button', { name: 'Create playlist', exact: true }).click();

    await page.getByRole('button', { name: 'More options for Road Trip', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit playlist', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete playlist', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open Road Trip', exact: true })).toBeVisible();
  });

  test('the picker creates a playlist and adds the current track in one press', async ({ page }) => {
    await openNowPlaying(page, 'Neon Orchard');
    await page.getByRole('button', { name: 'Save to playlist', exact: true }).click();

    await expect(page.getByText('No playlists yet. Create one below.', { exact: true })).toBeVisible();
    await page.getByLabel('New playlist name', { exact: true }).fill('Mix Tape');
    await page.getByRole('button', { name: 'Create playlist and add track', exact: true }).click();

    await expect(
      page.getByText('Created "Mix Tape" and added "Neon Orchard".', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Add to Mix Tape', exact: true })).toBeVisible();
  });

  // Device-only gap: PlaylistPickerSheet lists existing playlists through
  // db/repo.listPlaylists(), which reads SQLite. On web getDb() is null, so the
  // picker always starts empty and the two-checkbox Add flow cannot be
  // exercised without faking the database. Cover this on a device build.
  test.skip('picker multi-select adds the track to two playlists', async ({ page }) => {
    await openNowPlaying(page, 'Neon Orchard');
    await page.getByRole('button', { name: 'Save to playlist', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Add to Road Trip', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Add to Mix Tape', exact: true }).click();
    await page.getByRole('button', { name: 'Add to 2 playlists', exact: true }).click();
    await expect(page.getByText('Added to 2 playlists', { exact: false })).toBeVisible();
  });
});
