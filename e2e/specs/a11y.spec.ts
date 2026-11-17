import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, gotoLibrary, openSettings, test } from '../fixtures/app';

function summarize(violations: { id: string; impact?: string | null; nodes: unknown[] }[]) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.length,
  }));
}

async function expectNoBlockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical',
  );
  expect(blocking, JSON.stringify(summarize(blocking), null, 2)).toEqual([]);
}

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await gotoLibrary(page);
  });

  test('tabs expose role=tab and switch screens', async ({ page }) => {
    const libraryTab = page.getByRole('tab', { name: 'Library', exact: true });
    const importTab = page.getByRole('tab', { name: 'Import', exact: true });

    await expect(libraryTab).toBeVisible();
    await expect(importTab).toBeVisible();

    await importTab.click();
    await expect(page.getByRole('button', { name: 'Import audio files', exact: true })).toBeVisible();
    await libraryTab.click();
    await expect(
      page.getByRole('button', { name: 'Neon Orchard, Mira Vale · 4:49', exact: true }),
    ).toBeVisible();
  });

  test('Library has no critical axe violations', async ({ page }) => {
    await expectNoBlockingViolations(page);
  });

  test('Settings has no critical axe violations', async ({ page }) => {
    await openSettings(page);
    await expectNoBlockingViolations(page);
  });
});
