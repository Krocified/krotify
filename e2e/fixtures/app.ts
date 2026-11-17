import { test as base, expect, type Locator, type Page } from '@playwright/test';

export { expect };

const FIRST_TRACK = 'Neon Orchard, Mira Vale · 4:49';

/**
 * Every spec uses this fixture, which clears localStorage before the app
 * boots. Expo web maps AsyncStorage onto localStorage, so this keeps resume
 * state, scan preferences and anything else AsyncStorage-backed from leaking
 * between tests (Playwright already isolates browser contexts; this is belt
 * and braces, and matters when a spec navigates more than once).
 */
export const test = base.extend({});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
    } catch {
      // Storage can be unavailable in hardened browser modes.
    }
  });
});

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function trackButton(page: Page, title: string): Locator {
  return page.getByRole('button', {
    name: new RegExp(`^${escapeRegExp(title)}, .+ · \\d+:\\d{2}$`),
  });
}

/**
 * The search overlay and the library stay mounted together, so a plain
 * getByRole() sees both copies of a track row. Scope result lookups to the
 * search overlay (the root two levels above the Close search button).
 */
export function searchScope(page: Page): Locator {
  return page.getByRole('button', { name: 'Close search', exact: true }).locator('xpath=../..');
}

export function searchResult(page: Page, title: string): Locator {
  return searchScope(page).getByRole('button', {
    name: new RegExp(`^${escapeRegExp(title)}, .+ · \\d+:\\d{2}$`),
  });
}

export async function dismissFirstRun(page: Page): Promise<void> {
  const notNow = page.getByRole('button', { name: 'Not now', exact: true });
  if (await notNow.isVisible().catch(() => false)) {
    await notNow.click();
    await expect(notNow).toBeHidden();
  }
}

export async function gotoLibrary(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: FIRST_TRACK, exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await dismissFirstRun(page);
}

export async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hidden tracks', exact: true })).toBeVisible();
}

export async function openCollections(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Collections', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Playlists', exact: true })).toBeVisible();
}

export async function openPlaylists(page: Page): Promise<void> {
  await openCollections(page);
  await page.getByRole('button', { name: 'Playlists', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New playlist', exact: true })).toBeVisible();
}

export async function openSearch(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const input = page.getByLabel('Search title, artist, or album');
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  return input;
}

export async function openNowPlaying(page: Page, title: string): Promise<void> {
  await trackButton(page, title).click();
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
}

export async function closeNowPlaying(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open now playing', exact: true })).toBeVisible();
}
