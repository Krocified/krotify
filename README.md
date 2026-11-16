# Krotify

A local-first Android music player for the songs you already own. No account, no
network, no catalogue. Album art is the product; the chrome stays quiet.

## Status

Current version: `0.5.0`.

v0 through v5 are built. The app is a local-first player with a real library,
a chosen storage folder, app-owned metadata and tags, and recovery from missing
files:

- One `AudioPlaylist` engine: background playback, gapless tracks, notification
  and lock-screen next/previous, and live play/pause state.
- Library and Import tabs with a floating blur pill. Catalog is removed for
  now; its screen and grouping logic stay on disk for a later redesign.
- SQLite is the source of truth. Files are copied once into a folder chosen in
  Settings (`Krotify` by default, or the legacy `imports` folder on upgrade) and
  are never renamed or tag-written. Editing title, artist, album, artwork or
  tags changes the app's record, not the file.
- Imports use the system document picker, validate a non-zero copy without
  trusting the provider-reported size, probe duration best-effort, dedupe, and
  report each failure separately. A successful import returns to Library.
- YouTube links import through the ytmp3.ge API into the chosen folder, with the
  returned title and thumbnail. The Import tab is an action surface, not a list.
- App-local tags: create and assign them in the track editor and filter the
  Library with a chip bar above Recently played when tags exist.
- Hidden tracks have their own page. Restore returns a track; Clear removes it
  from the app and keeps the file; Delete removes both.
- Missing files are detected before playback, marked in the UI with Clear and
  Delete call to actions, and never wedge the next track.
- Playlists have a name, description, and cover, with Play, Shuffle and drag
  reorder. A heart in Now Playing persists to Liked Songs. Back closes overlays
  and routes first. The app exits only after a double press at Library.
- Shuffle, repeat, sleep timer with fade-out, resume, scan opt-in, and the system
  audio filters. Lyrics code stays on disk but its UI is hidden behind
  `LYRICS_ENABLED`.
- Schema v4 migrates an existing install in place, keeping legacy track ids.

Not shipped: v4 discovery is research-only. Genius, Radio Browser, and
Audiometa.io are deferred. Device verification for v4 is recorded in
`docs/research/v4-device-check.md`; v5 device checks (upgrade install, SAF
folder, ytmp3 download) are still pending.

## Stack

Expo SDK 58, React Native 0.88, TypeScript, `expo-audio` (`AudioPlaylist`),
`expo-document-picker`, `expo-media-library`, `expo-sqlite`, `expo-file-system`,
`expo-blur`, `@missingcore/react-native-metadata-retriever`, Ionicons,
`react-native-sortables` with `react-native-reanimated`,
`react-native-worklets`, and `react-native-gesture-handler`. Link import calls
the ytmp3.ge conversion API.

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
- `docs/superpowers/specs/`: v5 file-ownership design
- `docs/superpowers/plans/`: v0 plan, v2 catalog record, v3/v4 plans, v5 track
  store, player/settings, and library/link plans, plus the release workflow plan
- `docs/research/`: v4 API memos, batch edit, Android Auto research, the v4
  device check matrix, and the v5 SAF spike evidence

## Layout

```
src/
  AppShell.tsx        screen/overlay state, library load, sheets and wiring
  player/             AudioPlaylist engine, provider and missing-file recovery
  tracks/             track records, repository, metadata seeding, scan sync
  storage/            chosen storage root, owned files, downloads
  imports/            local import, ytmp3 link conversion, duration probe
  tags/               tag repository, provider, filter helpers
  library/            scan, artwork, playback source, lyrics
  db/                 SQLite schema, v4 migration and repository
  screens/            Library, Import, Search, Now Playing, Settings, Hidden,
                      Playlists, Liked, Edit Track (CatalogScreen unwired)
  components/         headers, tabs, cover art, rows, sheets, tag filter/editor
  lib/                queue, shuffle, sleep, lyrics, settings view (tested)
scripts/              release version helper
plugins/              Media3/R8 exclusions, notification icon, release signing
.github/workflows/    release pipeline
```
