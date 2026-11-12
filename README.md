# Krotify

A local-first Android music player for the songs you already own. No account, no
network, no catalogue. Album art is the product; the chrome stays quiet.

## Status

v0 and v1 are built, plus the v2 catalog data layer: ID3 metadata, albums,
artists, search, play history, background playback, import/exclude/delete,
repeat, Recently played, a draggable mini-player, Settings and a browser demo.

The phone UI currently shows Library only: Albums and Artists are hidden until
the v3 integration, while the web preview keeps them. The Settings Hidden tracks
list is also removed until v3; individual exclude/delete still work.

Scanning keeps the system filters: ringtones, notifications, alarms, UI sounds
and files under 3s are skipped.

Not built yet: playlist UI, favorites UI, notification next/previous, shuffle,
lyrics, and tag editing.

## Stack

Expo SDK 58, React Native 0.88, TypeScript, `expo-audio`, `expo-media-library`,
`expo-sqlite`, `@missingcore/react-native-metadata-retriever`, Ionicons.

## Run it

```bash
./run.sh          # build and install on a connected Android device
./run.sh web      # browser demo at http://localhost:8081
```

The Android app needs a dev build (Expo Go cannot load the background-playback
config). Prerequisites: JDK 17, Android platform-tools (`adb`), USB or wireless
debugging enabled.

Web is demo-only: the demo library and mock player work; device scanning,
background audio and notification controls are Android-only.

## Check it

```bash
npm test          # pure logic, node --test
npx tsc --noEmit
npx expo lint
npx expo export --platform web
```

## Releases

Pushing to `main` runs `.github/workflows/release.yml` on a GitHub-hosted
Ubuntu runner. It reads Conventional Commits since the last tag (`feat` minor,
`fix`/others patch, `BREAKING CHANGE` or `type!:` major), verifies the project,
builds a signed **arm64** APK (about 24-28MB instead of the 76MB universal
build), and publishes a GitHub release with the APK and a sha256.

Manual runs take a `bump` input (`auto`, `major`, `minor`, `patch`) so a major
release can be forced.

Release signing uses these repository secrets:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`. Without them the workflow warns and builds with the
debug keystore, which is installable but not upgrade-stable across runners.

## Docs

- `docs/intent.md`: why this exists
- `docs/spec.md`: behaviour, design tokens, milestones
- `docs/superpowers/plans/`: v0 plan, v2 catalog record, v3 plan and release
  workflow plan

## Layout

```
src/
  AppShell.tsx        screen state, library load, scan/import wiring
  player/             single expo-audio player plus a mock engine for demos
  library/            scan, metadata, imports, exclusions, demo tracks
  db/                 SQLite schema and repository
  screens/            Library, Albums, Artists, Search, Now Playing, Settings
  components/         headers, tabs, cover art, rows, mini-player, scrollbar
  lib/                hashing, formatting, queue, groups, search, clock (tested)
scripts/              release version helper
plugins/              Media3 exclusion and release signing config plugins
.github/workflows/    release pipeline
```
