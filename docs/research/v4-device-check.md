# v4 Device Verification Matrix

**Status:** device checks NOT RUN. No Android device or emulator was attached to
this session, so nothing in the device matrix is a pass.
**Date:** 2026-11-16
**Worktree:** `.worktrees/v4-core` on `feat/v4-core-experience`
**App version under test:** 0.3.1 (`versionCode` 301)
**Brief:** `.superpowers/sdd/2026-11-15-v4-core-experience/task-12-brief.md`
**Plan:** `docs/superpowers/plans/2026-11-15-v4-core-experience.md`

## Verification boundary

This task ran only the non-device checks. They prove the project type-checks,
lints, bundles for web, and passes its pure-logic tests. They do not exercise
Android import providers, MediaStore write access, gestures, back handling,
playback, SQLite on device, or an upgrade install.

A device claim is a pass only after it has been run on a real Android device
with the evidence noted in the matrix. Nothing below claims that.

## Non-device checks (run locally in this session)

The release workflow's `verify` job runs `npm test`, `npx tsc --noEmit` and
`npx expo lint`. The web export is an extra local check. All four were run here.

| Check | Command | Result |
|---|---|---|
| Unit and logic tests | `npm test` | PASS: 161 tests, 161 pass, 0 fail |
| Typecheck | `npx tsc --noEmit` | PASS: no output |
| Lint | `npx expo lint` | PASS: no output |
| Web export | `npx expo export --platform web` | PASS: exported `dist` (1117 modules) |

Notes:
- `node_modules` in this worktree was missing `expo-document-picker` even though
  the committed lockfile has it. `npm install --no-audit --no-fund` added it.
- `npx expo lint` first failed on `import/no-unresolved` for
  `expo-document-picker` because of a stale Expo lint cache at
  `.expo/cache/eslint/`. Removing that cache made lint pass. This was an
  environment cache issue, not a source error.
- The test suite covers the pure parts of the v4 work: `backIntent`,
  `importName`, `tagWriter`, `playlistOrder`, `playlistView`, `migration`,
  `version`, and the existing queue, shuffle, sleep, lyrics and search modules.

## Device matrix

Run each row on a development build installed on a real Android device. Record
pass or fail, the device and Android version, and the evidence path or log
excerpt. Any row left unrun stays `NOT RUN`.

| # | Check | Exact steps | Expected result | Status | Evidence |
|---|---|---|---|---|---|
| 1 | Import from Files | Import tab, choose files, pick an MP3 from the Files app. Open the row. | Row shows the real filename with a valid extension, the file plays, and embedded tags appear when present. | NOT RUN: no device attached | none |
| 2 | Import from Downloads | Repeat the import from the Downloads provider. | Same as row 1, including tags. | NOT RUN: no device attached | none |
| 3 | Import from Drive | Repeat the import from Google Drive. | Same as row 1, including the provider's display name and any embedded tags. | NOT RUN: no device attached | none |
| 4 | Import from SD card | If the device has an SD card, import from it. | Same as row 1. Record if no SD card is present. | NOT RUN: no device attached | none |
| 5 | Import of a 0-byte provider copy | Pick a provider file that returns a zero-byte cache copy. | The file is not listed. An import failure reason is shown, and no partial file is left behind. | NOT RUN: no device attached | none |
| 6 | Imported file plays after relaunch | Import a file, play it, force-stop the app, relaunch, and play it again. | The track is still listed once and plays from app storage after relaunch. | NOT RUN: no device attached | none |
| 7 | Rename imported file | Open the track actions, edit the title, save, force-stop, relaunch. | The write succeeds, the row and tags show the new title, and it survives relaunch. Also test an ID3v1-only MP3 and an ID3v2.2 MP3. | NOT RUN: no device attached | none |
| 8 | Rename scanned file or fall back to copy | Edit a scanned file from shared storage. If read-only, use the copy fallback. | Either the tag write succeeds in place or the app shows "Read-only track" with "Import a copy and edit". The original always plays. Record which path ran. | NOT RUN: no device attached | none |
| 9 | Back from every screen | Open Liked Songs and press back once. Open a playlist, open its edit sheet, and press back once. Then press back from Now Playing, Settings, Search, the sleep panel, the playlists index, a playlist detail, and the Import tab. | Liked Songs closes to Library on the first press. The playlist edit sheet closes to the playlist detail on the first press, with no playlist route or tab change. Both close before any other route is considered. Each later press closes the newest overlay or returns one route, and back never exits from these screens. Now Playing returns to the screen that opened it. | NOT RUN: no device attached | none |
| 10 | Double-press exit | At the Library root, press back once, then press back again within two seconds. | The first press shows "Press back again to exit". The second exits. No tab, detail or overlay exits on the first press. | NOT RUN: no device attached | none |
| 11 | Heart in Now Playing persists | Open Now Playing, tap the heart, open Liked Songs, force-stop, relaunch. | The heart fills, the track appears in Liked Songs, and both survive relaunch. Tapping again removes it from Liked Songs. | NOT RUN: no device attached | none |
| 12 | Playlist cover pick, remove and fallback | Create a playlist with no cover, add a track with art, pick a custom cover, relaunch, remove the cover, relaunch. | Fallback order is picked cover, then first track artwork, then the generated cover. No surface goes blank and each state persists. | NOT RUN: no device attached | none |
| 13 | Playlist description | Open the playlist edit sheet, enter a description, save, relaunch. | The description saves within 280 characters and appears on the detail hero, wrapping without pushing Play and Shuffle off screen. | NOT RUN: no device attached | none |
| 14 | Drag reorder with auto-scroll and cancel | Drag the first row to the last and back, drag at both scroll edges, then start a drag and cancel by backing out. | Rows follow the finger, auto-scroll reaches off-screen rows, a cancelled drag lands cleanly, and the visible order matches the persisted order. TalkBack Move up and Move down actions still work. | NOT RUN: no device attached | none |
| 15 | Playlist order persists and matches playback | Reorder a playlist, force-stop, relaunch, open it, and play as a queue. | The saved order matches the screen, and playback follows the same order. | NOT RUN: no device attached | none |
| 16 | Catalog tab gone | Open the app and inspect the tab bar and routes. | Only Library and Import tabs exist. There is no Catalog tab and no route to `CatalogScreen`. Artwork features still work. | NOT RUN: no device attached | none |
| 17 | Artwork in Library and Now Playing | Cold launch with scanned and imported tracks that have embedded art. Open a row and Now Playing. | Artwork appears in Library rows and in Now Playing without opening Catalog first. Tracks without art keep the generated cover. | NOT RUN: no device attached | none |
| 18 | Migration from `v0.3.1 / DB v2` to `branch build / DB v3` | Install the old build (`v0.3.1 / DB v2`), create a playlist, add a track, then install the branch build (`branch build / DB v3`) over it without clearing data. Open Playlists and query `PRAGMA user_version`. | The app starts without a crash, the playlist data survives, and `PRAGMA user_version` is 3. The new description and cover columns work. | NOT RUN: no device attached | none |

## Failure capture

No device failures were produced because no device run happened. If a row fails
during a later run, capture both logs before changing code:

```bash
adb logcat -c
# reproduce the failing step
adb logcat -b crash > crash-<row>.log
adb logcat -d > normal-<row>.log
```

Attach or link both files next to the failing row, record the device model and
Android version, and keep the row as fail until a repeat run passes. Never
upgrade a row to pass from reasoning, screenshots of unrelated screens, or a
successful web build.

## What is still required before release

1. Connect a development build device and run rows 1 to 18.
2. Replace every `NOT RUN` with a pass or fail plus evidence.
3. File the failing rows before tagging a v4 release.
4. Keep this doc's non-device section as the record of what CI-like checks
   covered; it is not a substitute for the device matrix.
