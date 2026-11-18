# Krotify

A local-first Android music player for the songs you already own. No account, no
catalogue, no network needed to play. Covers lead; the chrome stays quiet.

## What it does

- Plays your local library with background audio, notification controls and lock-screen next/previous.
- Keeps SQLite as the truth. Files are copied once into a folder you pick in Settings and never renamed or tag-written. Edits change the app's record, not the file.
- Browses as a collection: Library with tag chips, Collections for Liked Songs, Playlists, Artists and Albums.
- Imports with the system picker, one copy per file, a determinate progress bar and a working Cancel. Rows appear as files land.
- Edits title, artist, album, year, genre, tags and cover in the app. Covers come from the gallery or from files and crop to a square.
- Selects many songs at once to hide, delete, tag or add to playlists. Select all scoped to the visible rows, and back cancels the selection.
- Fills a playlist from inside it: search, filter by tag, select all, add N songs, without leaving the playlist.
- Shows local `.lrc` lyrics with timed highlight, auto-scroll and tap-to-seek.
- Plays on a player page with an ambient backdrop built from the cover's colors, two primary controls, and a sleep timer behind one expand.

Hidden tracks have their own page. A missing file is marked and never stops the next track. Link import is off behind `LINK_IMPORT_ENABLED`; the companion `server/` app stays on disk.

## Status

Version `0.8.0`. v0 through v8 are built. Device checks for v8 (cropper, import, ambient, notification seek bar) are listed in `docs/research/v8-device-checks.md` and still pending.

## Run it

```bash
./run.sh          # build and install on a connected Android device
./run.sh web      # browser demo at http://localhost:8081
```

The Android app needs a dev build; Expo Go cannot load the background-playback config. Prerequisites: JDK 17, Android platform-tools, USB or wireless debugging.

The web build is a demo: demo library and mock player only. Scanning, background audio and notification controls are Android-only.

## Check it

```bash
npm test                    # pure logic, node --test
npx tsc --noEmit
npx expo lint
npx expo export --platform web
```

## Releases

Pushing to `main` runs `.github/workflows/release.yml`. It reads Conventional Commits since the last tag (`feat` minor, `fix` and others patch, `type!:` or `BREAKING CHANGE` major), verifies the project, builds a signed arm64 APK around 24-25MB, and publishes a GitHub release with `krotify-<version>.apk` and its sha256. Manual runs take a `bump` input of `auto`, `major`, `minor` or `patch`.

Signing needs `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. Without them the workflow warns and builds with the debug keystore, which installs but is not upgrade-stable across runners.

## Docs

- `docs/intent.md`: why this exists.
- `docs/spec.md`: behaviour, design tokens, milestones.
- `docs/superpowers/plans/`: the plans each version was built from, including the v8 index.
- `docs/research/`: device checks, API memos and explorations.

## Layout

```
src/
  AppShell.tsx        screen and overlay state, library load, wiring
  player/             AudioPlaylist engine, provider, recovery
  tracks/             track records, repository, metadata seeding, scan sync
  storage/            storage root, owned files, downloads
  imports/            local import, link client, duration probe
  tags/               tag repository, provider, filters
  library/            scan, palette, artist art, lyrics, cropper
  db/                 SQLite schema, migrations, repository
  screens/            Library, Import, Search, Now Playing, Settings, Hidden,
                      Collections, Playlists, Liked, Edit Track, Tech stack
  components/         headers, tabs, rows, sheets, cropper, player pieces
  lib/                pure logic with tests: selection, queue, crop, ambient, more
server/               link service: Express and yt-dlp
modules/              local Expo modules (AndroidX Palette)
scripts/              release version helper, e2e server
plugins/              Media3/R8 exclusions, notification icon, release signing
.github/workflows/    release pipeline
```
