# Krotify end-to-end tests

Playwright drives Chromium against the Expo web export. The web build is the
demo surface: demo library, mock playback, in-memory favorites, and no SQLite.
That is the right place to prove navigation, layout, state transitions and
keyboard/accessible names. It is not a substitute for testing Android playback,
MediaStore scanning, SAF folders or link downloads — see the gaps below.

## Run

```bash
npm install
npx playwright install chromium

npm run e2e          # headless, both mobile projects
npm run e2e:ui       # interactive UI mode
```

The first run builds the web export automatically (`npx expo export --platform
web`) with `EXPO_PUBLIC_E2E=1`. Force a fresh export after app changes with:

```bash
E2E_REBUILD=1 npm run e2e
```

`scripts/e2e-server.mjs` serves `dist/` on `http://127.0.0.1:4173` with caching
disabled and a `/health` endpoint. Playwright starts and stops it through
`webServer`.

## Layout

```
e2e/
  playwright.config.ts   390x844 and 412x915 mobile projects
  fixtures/app.ts        navigation helpers + localStorage reset
  specs/                 library, search/player, settings, editor/tags,
                         playlists, import/about
  tsconfig.json
```

Selectors prefer roles and accessible names. No test-only `testID`s were added
to the app. `EXPO_PUBLIC_E2E=1` is only used to skip the first-run scan prompt in
`src/library/scanPrefs.ts`.

## Web vs device gaps

These flows are intentionally skipped because Expo web has no SQLite
(`getDb()` returns `null`) or because the demo library is read-only. They must be
covered on a device build or, later, Maestro/Appium:

- Track action sheet and its Details/Tags/Exclude/Delete actions. Demo tracks
  are read-only on web (`AppShell.handleManage` returns early).
- Tag creation, assignment, filtering and deletion.
- Playlist multi-select picker. `listPlaylists()` reads SQLite, so the picker
  never sees playlists that were created earlier in the session.
- Format and file size in Track details for demo tracks (no `uri`).
- MediaStore scan, permissions, SAF folders, real `expo-audio` playback,
  notification/lock-screen controls, and link downloads.

