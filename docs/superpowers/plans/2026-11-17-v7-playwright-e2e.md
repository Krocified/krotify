# v7 Playwright end-to-end test plan

## Goal

Prove the everyday web surface of Krotify with a real browser: navigation, library,
search, player controls, settings and hidden layers, inline editing, tags, and the
import surface. Catch regressions like the v5.1 "Settings covers everything" bug
before a device build.

## Why Playwright, and where it stops

Playwright drives Chromium against the Expo web build. The web build is the demo
surface: demo library, mock playback, in-memory favorites and tags. It is the right
place to test layout, navigation, state transitions and keyboard behavior.

Playwright cannot test the Android app, MediaStore scanning, SAF folders, real
`expo-audio`, notification controls, APK installs, or the link downloader's native
file writes. Those belong to a device matrix and, later, Maestro or Appium. This
plan does not pretend otherwise.

## Constraints

- Node 24, Expo SDK 58, React Native Web.
- Tests run against `npx expo export --platform web` served by a local static
  server. Do not test the Metro dev server: its HMR and error overlays are not
  production behavior.
- The suite must be deterministic: no real scan prompt, no real network, no
  `AsyncStorage` leakage between tests, no timing sleeps except a short settle.
- Selectors use roles and accessible names first, `testID` only when a name is
  ambiguous.
- Mobile viewport is the default: `390 x 844`. A second project runs `412 x 915`.
- The suite runs on every pull request and on `main`, and must stay under five
  minutes.

## Architecture

```
e2e/
  playwright.config.ts
  fixtures/
    seed.ts            deterministic demo library, tags, playlists, history
    app.ts             page helpers: openLibrary, openSettings, dismissFirstRun
  specs/
    library.spec.ts
    search-player.spec.ts
    settings-hidden.spec.ts
    editing.spec.ts
    tags.spec.ts
    import-link.spec.ts
    a11y.spec.ts
  tsconfig.json
```

`playwright.config.ts` uses `webServer`:

```ts
webServer: {
  command: 'node scripts/e2e-server.mjs',
  url: 'http://127.0.0.1:4173/health',
  reuseExistingServer: !process.env.CI,
}
```

`scripts/e2e-server.mjs` builds the web export once (or reuses `dist/`) and serves
it with cache disabled. The health route is a tiny 200 from the static server.

### Deterministic web mode

Add `EXPO_PUBLIC_E2E=1` (read through `process.env.EXPO_PUBLIC_E2E` at build time):

- skip the first-run scan prompt;
- use the demo library and a fresh in-memory store for tags, favorites, playlists,
  history and resume;
- never call MediaStore, SAF, audio, or the link service;
- expose `window.__krotifyE2E` with a small, documented API to reset state and read
  the current route. This is test-only and stripped from production builds;
- freeze relative timestamps used by history so the later Home section is testable
  and screenshots stay stable.

## Test suites

### 1. Library

- App loads on Library with the demo tracks and no Settings overlay.
- Library is only the tag pills and the flat song list: no Recently played, no
  Liked Songs row, no Playlists rail.
- Tag bar is absent when no tag has an active track.
- Scrolling reaches the bottom without horizontal overflow.
- Each row shows cover, title and `artist · duration`, and its ellipsis opens the
  same action sheet as a long press.

### 2. Search and player

- Search opens, auto-focuses, filters by title/artist/album, and Escape/back closes
  it.
- Selecting a result opens Now Playing.
- Demo playback advances; play/pause, next and previous update the title.
- Mini-player appears, expands to Now Playing, and its close button stops the track.
- Sleep timer opens and closes without leaving the player.

### 3. Settings and hidden layers

- Settings is absent on load (the v5.1 regression).
- Gear opens Settings; Library and Import tabs remain visible.
- Hidden tracks slides over Settings; Settings is still open underneath.
- Back from Hidden returns to Settings; back from Settings returns to the screen
  that opened it.
- The Hidden tracks row has no track count; the count appears on the page.
- Storage has no link-service fields.
- The version row opens the Tech stack page; back returns to Settings. About and
  Tech stack both show `Created by Krocified`.
- Permission, scan summary, exclude-all count and storage rows render real labels.

### 4. Inline editing

- Long-press a track opens the action sheet with Details, Tags, Save to playlist,
  Favorite, Exclude and Delete. There is no Edit metadata or Rename.
- Details shows duration, format and file size.
- Pencil switches to the editor with title, artist, album, year, genre and artwork.
- Empty title is rejected; a changed title saves and appears in the library.
- Cancel restores the previous values.

### 5. Tags

- Create a tag in the editor, assign it, and see the filter bar appear.
- Filter by the tag narrows the list.
- Unassign the last track and the bar disappears.
- Settings lists the tag with its count, creates another tag, and deletes one
  after confirmation; the deleted tag leaves every song.
- Now Playing tag button opens the same sheet and toggles an assignment.
- Bookmark opens the playlist picker and saving reports success.
- The picker creates a playlist and adds the current track in one press.
- Checking two playlists and pressing Add reports both; a partial failure names
  the playlist that failed.

### 6. Import and link surface

- Import has no recent-imports list.
- The local import card fills more of the screen and has the drop-field border.
- On web, local import is disabled with "Available on device builds".
- Import shows no YouTube link card and no link empty state.
- Settings shows no link-service URL or token field.
- A direct settings write that enables the flag is still covered by the module
  tests; the default UI stays hidden.

### 7. Accessibility

- Tabs expose `role=tab` and the selected state.
- Settings, Search and Now Playing controls have accessible names.
- Keyboard Tab reaches the header actions and tab bar in visual order.
- No critical axe violations on Library, Settings, Hidden and Now Playing. Run
  `@axe-core/playwright` and fail on `critical` and `serious`.

## CI

Add `.github/workflows/e2e.yml`:

1. checkout, Node 24, `npm ci`.
2. `npx playwright install --with-deps chromium`.
3. `npm run e2e`.
4. Upload `playwright-report/` and failure screenshots/traces.
5. Run on `pull_request` and on pushes to `main`.

`package.json` scripts:

```json
"e2e": "playwright test",
"e2e:ui": "playwright test --ui"
```

## Tasks

1. Add `@playwright/test`, `@axe-core/playwright`, the config, the static server and
   the `e2e` scripts.
2. Add `EXPO_PUBLIC_E2E` mode, the in-memory store, the seed fixture and the
   `window.__krotifyE2E` reset/read API.
3. Add stable `testID`s only where roles and labels are ambiguous.
4. Implement the library and search/player specs.
5. Implement settings/hidden, including the regression test that Settings is
   absent on load.
6. Implement editing and tags specs.
7. Implement import/link and accessibility specs.
8. Add the CI workflow and a short `e2e/README.md` with local commands.
9. Record what remains device-only in `docs/research/v7-e2e-gaps.md`.

## Acceptance

- `npm run e2e` passes locally against a clean export.
- The suite fails if Settings is visible on load, if a tab does not unload Settings,
  or if a track action opens the old Edit/Rename paths.
- No test depends on the network, real time, scan permissions, or a prior run.
- CI runs the suite in under five minutes and uploads a report on failure.

## Device-only matrix (not Playwright)

These stay manual or move to Maestro/Appium later:

- MediaStore scan, permission grant and denial, scan summary.
- SAF folder pick, move, clean, download persistence across relaunch.
- Real `expo-audio` playback, background playback, lock screen and notification.
- ytmp3/link-service download into the chosen folder.
- APK install, signing, versionCode, upgrade over a previous release.
- v3 -> v4 database migration on a real device.
