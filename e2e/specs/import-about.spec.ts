import { expect, gotoLibrary, openSettings, test } from '../fixtures/app';

test.describe('Import and About', () => {
  test.beforeEach(async ({ page }) => {
    await gotoLibrary(page);
  });

  test('Import has no link card and the local import card is device-only', async ({ page }) => {
    await page.getByRole('tab', { name: 'Import', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Import audio files', exact: true })).toBeVisible();
    await expect(page.getByText('Available on device builds', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Tap to copy audio files into the app', { exact: true }),
    ).toHaveCount(0);

    // LINK_IMPORT_ENABLED is false in this build.
    await expect(page.getByText('From a link', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('YouTube link', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Recent imports', { exact: true })).toHaveCount(0);
  });

  test('About shows the Created by Krocified watermark', async ({ page }) => {
    await openSettings(page);
    // The Tech stack screen is mounted but hidden and also carries the
    // watermark, so assert on the visible copy.
    await expect(
      page.getByText('Created by Krocified', { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();
  });
});
