# Krotify

A local-first Android music player for the songs you already own. No account, no
network, no catalogue. Album art is the product; the chrome stays quiet.

## Status

v0 through v3 are built. The app is a local-first player with a real catalog
and session controls:

- One `AudioPlaylist` engine: background playback, gapless tracks, notification
  and lock-screen next/previous, and live play/pause state.
- Library, Catalog (Albums/Artists), and Import tabs with a floating blur pill.
- Playlists (create, rename, delete, reorder, add/remove, play as queue) and
  Liked Songs.
- Shuffle, repeat, a sleep timer with fade-out, and resume of the last track and
  position after restart.
- Lyrics from local `.lrc` sidecars or the opt-in LRCLIB lookup, with timed
  highlight and tap-to-seek.
- In-app track sheets, details, rename, exclude/delete confirmation, and tag or
  artwork editing through a local jaudiotagger module.
- Scan opt-in, hidden-track restore, and the system audio filters (ringtones,
  notifications, alarms, UI sounds, files under 3s).

Not built: v4 discovery is research-only. Genius, Radio Browser, and
Audiometa.io are deferred pending credentials, terms, and a real-device radio
playback gate. Link import ships visibly disabled until a resolver is chosen.

## Stack

Expo SDK 58, React Native 0.88, TypeScript, `expo-audio` (`AudioPlaylist`),
`expo-media-library`, `expo-sqlite`, `expo-file-system`, `expo-blur`,
`@missingcore/react-native-metadata-retriever`, Ionicons, and a local Kotlin
Expo module backed by jaudiotagger.

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
builds a signed **arm64** APK (about 24-25MB instead of the 76MB universal
build), and publishes a GitHub release with the APK and a sha256. Release notes
name the ABI and record the APK size measured from the built artifact.

Manual runs take a `bump` input (`auto`, `major`, `minor`, `patch`) so a major
release can be forced.

For emulator testing, build a universal APK locally:

```bash
npx expo prebuild --platform android --clean --no-install
cd android && ./gradlew :app:assembleRelease \
  -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86,x86_64 --no-daemon
```

Release signing uses these repository secrets:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`. Without them the workflow warns and builds with the
debug keystore, which is installable but not upgrade-stable across runners.

## Docs

- `docs/intent.md`: why this exists
- `docs/spec.md`: behaviour, design tokens, milestones, v4 verdicts
- `docs/superpowers/plans/`: v0 plan, v2 catalog record, v3/v4 plans and release
  workflow plan
- `docs/research/`: v4 API memos, link-import decision, batch edit and Android
  Auto research

## Layout

```
src/
  AppShell.tsx        screen/overlay state, library load, sheets and wiring
  player/             AudioPlaylist engine and player provider
  library/            scan, metadata, imports, exclusions, lyrics, tag writer
  db/                 SQLite schema, migrations and repository
  screens/            Library, Catalog, Import, Search, Now Playing, Settings,
                      Playlists, Liked, Edit Track
  components/         headers, tabs, cover art, rows, sheets, mini-player
  lib/                queue, shuffle, sleep, lyrics parser, groups, search (tested)
modules/audio-tags/   local Expo module: jaudiotagger read/write
scripts/              release version helper
plugins/              Media3/R8 exclusions, notification icon, release signing
.github/workflows/    release pipeline
```
