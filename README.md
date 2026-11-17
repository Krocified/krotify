# Krotify

A local-first Android music player for the songs you already own. No account, no
network, no catalogue. Album art is the product; the chrome stays quiet.

## Status

Current version: `0.7.1`.

v0 through v7 are built. The app is a local-first player with a real library,
a chosen storage folder, app-owned metadata and tags, local lyrics, and recovery
from missing files. Device verification for v7 (blur, cropper, palette and
lyrics) is still pending.

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
- YouTube links import through the companion service in `server/`, configured in
  Settings. It extracts the best audio, verifies the file is playable, and never
  adds an HTML or 0:00 track. The Import tab is an action surface, not a list.
- App-local tags: create and assign them in the track editor or in Settings,
  delete them from Settings, and filter the Library with a chip bar.
- Hidden tracks have their own page. Restore returns a track; Clear removes it
  from the app and keeps the file; Delete removes both.
- Missing files are detected before playback, marked in the UI with Clear and
  Delete call to actions, and never wedge the next track.
- Playlists have a name, description, and cover, with Play, Shuffle and drag
  reorder. A heart in Now Playing persists to Liked Songs. Back closes overlays
  and routes first. The app exits only after a double press at Library.
- Shuffle, repeat, sleep timer with fade-out, resume, scan opt-in, and the system
  audio filters.
- Local lyrics: import a `.lrc` from Now Playing, cached per track in SQLite,
  with timed highlight, auto-scroll and tap-to-seek. LRCLIB stays a gated
  exploration; v7 makes no lyrics network call.
- Library is only the song list plus tag pills. A Collections control in the
  header opens a section with Liked Songs, Playlists, Artists and Albums, each
  with its own searchable list and Play/Shuffle detail.
- Playlists are a two-column cover grid with inline create, per-card edit/delete
  and track counts. Detail keeps Play, Shuffle and drag reorder.
- Artwork: the real cover tints Now Playing through a local AndroidX Palette
  module, with the generated hue as fallback. Track and playlist covers can be
  cropped square with pinch, pan and `expo-image-manipulator`.
- About shows the version as a button into a Tech stack page and carries a
  "Created by Krocified" credit. The Hidden tracks row no longer shows a count.
- YouTube link import is hidden in v7 behind `LINK_IMPORT_ENABLED = false`; the
  client, Settings fields and `server/` stay on disk for later.
- Schema v4 migrates an existing install in place, keeping legacy track ids.

Not shipped: v4 discovery is research-only. Genius, Radio Browser, Audiometa.io
and LRCLIB are deferred. Device verification for v4 is recorded in
`docs/research/v4-device-check.md`; v5 and v7 device checks (upgrade install, SAF
folder, link-service download, blur, cropper, palette, lyrics) are still
pending.

## Stack

Expo SDK 58, React Native 0.88, TypeScript, `expo-audio` (`AudioPlaylist`),
`expo-document-picker`, `expo-media-library`, `expo-sqlite`, `expo-file-system`,
`expo-blur`, `expo-image-manipulator`, `@missingcore/react-native-metadata-retriever`,
Ionicons, `react-native-sortables` with `react-native-reanimated`,
`react-native-worklets`, and `react-native-gesture-handler`. A local Expo module
in `modules/ambient-palette/` wraps AndroidX Palette for cover colors. Link
import calls the companion `server/` service (Express + `yt-dlp`).

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

## Link service

YouTube link import needs the companion service in `server/`. It is a small
Express app over `yt-dlp`:

- `GET /info/:videoId` -> title, thumbnail, duration
- `GET /video/:videoId` -> best-quality MP3

Run it on your PC:

```bash
./run-server.sh
```

It reads `server/.env`, finds `server/bin/yt-dlp`, prints the LAN URL, and serves on
port 3000. Put that URL and token in Krotify: Settings > Storage > Link service.
All server state (binary, `.env`, temp files, logs) stays under `server/`.

### Phone access with Tailscale

```bash
sudo tailscale up
tailscale ip -4
```

Install Tailscale on the phone, sign in to the same account, and open
`http://<tailscale-ip>:3000/health` in the phone browser. Use
`http://<tailscale-ip>:3000` in Settings. The app allows cleartext HTTP through
`plugins/with-cleartext.js`, so rebuild the APK/dev client after pulling this
change.

Or deploy it on Render with the root `render.yaml` (Docker). Details are in
`server/README.md`.

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
build), and publishes a GitHub release with `krotify-<version>.apk` and its
sha256. Release notes
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
  store, player/settings, library/link plans, the release workflow plan, and the
  v7 UX, playlists, artwork and lyrics plans
- `docs/research/`: v4 API memos, batch edit, Android Auto research, the v4/v7
  device check matrices, the v5 SAF spike, and the v7 LRCLIB exploration

## Layout

```
src/
  AppShell.tsx        screen/overlay state, library load, sheets and wiring
  player/             AudioPlaylist engine, provider and missing-file recovery
  tracks/             track records, repository, metadata seeding, scan sync
  storage/            chosen storage root, owned files, downloads
  imports/            local import, link service client, duration probe
  tags/               tag repository, provider, filter helpers
  library/            scan, artwork/palette, playback source, lyrics, cropper
  db/                 SQLite schema, v4 migration and repository
  screens/            Library, Import, Search, Now Playing, Settings, Hidden,
                      Collections, Playlists, Liked, Edit Track, Tech stack
  components/         headers, tabs, cover art/rows, sheets, cropper, collections
  lib/                queue, shuffle, sleep, lyrics, crop, layer target (tested)
server/               Render link service: Express + yt-dlp
modules/              local Expo modules (AndroidX Palette)
scripts/              release version helper and E2E server
plugins/              Media3/R8 exclusions, notification icon, release signing
.github/workflows/    release pipeline
```
