import { expect, gotoLibrary, openSettings, test, trackButton } from '../fixtures/app';

test.describe('Settings and hidden layers', () => {
  test.beforeEach(async ({ page }) => {
    await gotoLibrary(page);
  });

  test('Settings is absent on load and the gear opens an overlay', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hidden tracks', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Rescan device audio', exact: true })).toHaveCount(0);

    await openSettings(page);
    await expect(page.getByRole('tab', { name: 'Library', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Import', exact: true })).toBeVisible();
  });

  test('Hidden tracks slides over Settings and both backs return correctly', async ({ page }) => {
    await openSettings(page);

    const hiddenRow = page.getByRole('button', { name: 'Hidden tracks', exact: true });
    await expect(hiddenRow).toBeVisible();
    await expect(hiddenRow).toHaveAttribute('aria-label', 'Hidden tracks');
    await expect(page.getByText('Restore or remove hidden tracks', { exact: true })).toBeVisible();

    await hiddenRow.click();
    await expect(
      page.getByText('No hidden tracks. Tracks you hide from the library appear here.', {
        exact: true,
      }),
    ).toBeVisible();
    // Settings stays mounted underneath the sliding Hidden tracks screen.
    await expect(page.getByText('Sleep timer', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Back', exact: true }).last().click();
    await expect(hiddenRow).toBeVisible();

    // The Hidden tracks screen stays mounted for its slide-out animation, so
    // target Settings' Back (first in DOM) explicitly.
    await page.getByRole('button', { name: 'Back', exact: true }).first().click();
    await expect(trackButton(page, 'Neon Orchard')).toBeVisible();
  });

  test('version opens Tech stack, back returns, and both show the watermark', async ({ page }) => {
    await openSettings(page);

    const version = page.getByRole('button', { name: /Krotify .*view tech stack/ });
    await expect(version).toBeVisible();
    await version.click();

    await expect(page.getByText('Tech stack', { exact: true })).toBeVisible();
    await expect(page.getByText('Created by Krocified', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Back', exact: true }).last().click();
    await expect(page.getByText('Tech stack', { exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Hidden tracks', exact: true })).toBeVisible();
    await expect(page.getByText('Created by Krocified', { exact: true }).first()).toBeVisible();
  });

  test('default settings render real labels and no link-service fields', async ({ page }) => {
    await openSettings(page);

    await expect(page.getByText('Permission', { exact: true })).toBeVisible();
    await expect(page.getByText('Not asked', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rescan device audio', exact: true })).toBeVisible();
    await expect(page.getByText('No scan yet', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Exclude all scanned tracks', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('No scanned tracks to exclude', { exact: true })).toBeVisible();
    await expect(page.getByText('Current folder', { exact: true })).toBeVisible();
    await expect(page.getByText('Sleep timer', { exact: true })).toBeVisible();
    await expect(page.getByText('Release ABI', { exact: true })).toBeVisible();

    // LINK_IMPORT_ENABLED is false, so these fields must not exist at all.
    await expect(page.getByLabel('Link service URL', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Link service token', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Link service URL', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Link service token', { exact: true })).toHaveCount(0);
  });
});
