import {
  closeNowPlaying,
  expect,
  gotoLibrary,
  openNowPlaying,
  openSettings,
  test,
  trackButton,
} from '../fixtures/app';

test.describe('Inline editing and tags UI', () => {
  test.beforeEach(async ({ page }) => {
    await gotoLibrary(page);
  });

  // The action sheet is unreachable for the demo library on web (demo tracks
  // are read-only), so the editor is opened through Now Playing > Track details.
  test('Track details opens the pencil editor with every metadata field', async ({ page }) => {
    await openNowPlaying(page, 'Neon Orchard');

    await page.getByRole('button', { name: 'Track details', exact: true }).click();
    await expect(page.getByText('Track details', { exact: true })).toBeVisible();
    await expect(page.getByText('Duration', { exact: true })).toBeVisible();
    await expect(page.getByText('Title', { exact: true })).toBeVisible();
    await expect(page.getByText('Artist', { exact: true })).toBeVisible();
    await expect(page.getByText('Album', { exact: true })).toBeVisible();
    await expect(page.getByText('Genre', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit track details', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Edit track details', exact: true }).click();

    await expect(page.getByPlaceholder('Title', { exact: true })).toHaveValue('Neon Orchard');
    await expect(page.getByPlaceholder('Artist', { exact: true })).toHaveValue('Mira Vale');
    await expect(page.getByPlaceholder('Album', { exact: true })).toHaveValue('Neon Orchard');
    await expect(page.getByPlaceholder('Genre', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Year', { exact: true })).toHaveValue('2024');
    await expect(page.getByRole('button', { name: 'Choose artwork', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();

    await expect(page.getByText('Tags', { exact: true }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByText('No tags yet. Create one below.', { exact: true })).toBeVisible();
    await expect(
      page.getByLabel('New tag', { exact: true }).filter({ visible: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Add tag', exact: true }).filter({ visible: true }),
    ).toHaveCount(1);
  });

  test('a changed title saves and appears back in the library', async ({ page }) => {
    await openNowPlaying(page, 'Neon Orchard');
    await page.getByRole('button', { name: 'Track details', exact: true }).click();
    await page.getByRole('button', { name: 'Edit track details', exact: true }).click();

    await page.getByPlaceholder('Title', { exact: true }).fill('Neon Orchard Live');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await closeNowPlaying(page);
    await expect(trackButton(page, 'Neon Orchard Live')).toBeVisible();
  });

  test('Settings shows the tag section even though web tags cannot be written', async ({ page }) => {
    await openSettings(page);

    await expect(page.getByText('Tags', { exact: true }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByText('No tags yet.', { exact: true }).filter({ visible: true })).toHaveCount(1);
    await expect(
      page.getByLabel('New tag', { exact: true }).filter({ visible: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Add tag', exact: true }).filter({ visible: true }),
    ).toHaveCount(1);
  });

  // Device-only gap: tags live in SQLite. On web `getDb()` is null, so
  // createTag() returns null and the write never persists. The real
  // create/delete flow must be covered on a device build.
  test.skip('creates and deletes a tag from Settings', async ({ page }) => {
    await openSettings(page);
    await page.getByLabel('New tag', { exact: true }).fill('Road Trip');
    await page.getByRole('button', { name: 'Add tag', exact: true }).click();
    await expect(page.getByText('Road Trip', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Road Trip', exact: true }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Road Trip', { exact: true })).toHaveCount(0);
  });
});
