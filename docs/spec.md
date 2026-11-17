# krotify — Spec

Source of truth for what gets built. Intent lives in `docs/intent.md`.

## Platform & stack
| Concern | Choice | Why |
|--------|--------|-----|
| Platform | Android (APK) | User's device; local file access is native territory |
| Framework | React Native via Expo (dev build) | Fast UI iteration; ships an APK |
| Language | TypeScript | Default for Expo templates |
| Scan | `expo-media-library` | Reads every device audio file + permissions |
| Import | `expo-document-picker` | Real provider filename, MIME and size; `File.pickFileAsync` returns document ids |
| File ops | `expo-file-system` | Delete, copy imported files |
| Playlist reorder | `react-native-sortables` with Reanimated 4, Worklets and Gesture Handler | Drag rows with auto-scroll and persisted order |
| Playback | `expo-audio` (all versions) | Ships background playback + lock-screen/notification controls itself |
| Metadata/art | `react-native-metadata-retriever` (v2) | ID3 tags + embedded cover art |
| Persistence | AsyncStorage in v1, `expo-sqlite` in v2 | v1: imported tracks, exclusions. v2: playlists, favorites, history |
| Visuals | `expo-linear-gradient`, `expo-blur`, `react-native-safe-area-context`, RN `Animated` | Gradients, glass pill, insets, motion |

No `react-navigation` yet — v0 navigates between Library and Now Playing with a
single animated state. Add a navigator only when Albums/Artists/Search land.

## Milestones

Each milestone must run on a real device and be usable on its own.

### v0 — Prove the loop
- Request audio permission; scan the device for **all** audio files (any audio
  MIME type, no minimum duration filter).
- Flat track list with generated cover art, filename-derived title and duration.
  v0 has no artist column — `expo-media-library` exposes no tags.
- Tap a track → Now Playing.
- Play / pause / seek with `expo-audio`; progress advances.
- **Background playback from v0**: app keeps playing when the screen locks,
  with notification-drawer and lock-screen controls. Requires the `expo-audio`
  config plugin (`enableBackgroundPlayback`), `shouldPlayInBackground: true`,
  `interruptionMode: 'doNotMix'`, and `setActiveForLockScreen(true, metadata)`.
- **Dev build from day 1** (`npx expo run:android`): the plugin edits the
  Android manifest, so Expo Go cannot prove this milestone.
- Mini-player docked above the fold when a track is active.
- Graceful demo library when permission is denied or the device has no audio.

**Acceptance**
- On a device with MP3s, tracks appear and actually play.
- Locking the screen keeps audio playing; notification and lock-screen controls
  pause, resume and skip.
- With no permission, the app still shows demo tracks and a working mock player.
- A track's cover is visible in the list and full-screen in Now Playing.

**v0 details**
- Scan every `MediaType.AUDIO` asset, paged (200 at a time) with a loading state;
  dedupe by asset id. Sort A→Z by title.
- Single player instance owned above the screens (`createAudioPlayer`) so it
  survives navigation; `useAudioPlayerStatus` polls at 500ms.
- Request notification permission via `Audio.requestNotificationPermissionsAsync()`
  on first play (Android 13+), and `granularPermissions: ['audio']` for media.
- Failure policy: unreadable/unsupported file → skip it, brief inline message,
  never crash the list.
- Back collapses Now Playing to the Library; mini-player stays.
- App shell: `applicationId`, version, icon, splash, dark status bar — enough to
  install a signed APK.
- Empty/permission/scanning states are designed, not afterthoughts.

**Open:** none. v0 shows filename-derived titles only; real tags arrive with the
ID3 retriever in v2.

### v1 — It's a music app

Delivered:
- Queue from the visible list; in-app next/previous, auto-advance and repeat
  off/all/one.
- Two-tier previous (past 3s restarts, otherwise previous), instant track
  switches, resume when reopening the current track.
- Import via the system file picker, copied into app storage, deduped by source
  name + size, indexed in AsyncStorage.
- Exclude/delete per track; exclude all scanned tracks; restore from Settings.
- Scan filters: ringtones/notifications/alarms/UI sounds and files under 3s are
  skipped. Imports bypass the filter.
- Background playback with notification/lock-screen play, pause and seek.

Pending:
- Notification/lock-screen next and previous. A single `AudioPlayer` ignores
  them; this needs the `AudioPlaylist` engine planned in Next session.
- Scan opt-in prompt.

**Acceptance**
- Next/prev traverse the queue in order in the app.
- An imported file plays after a restart and appears once, not twice.
- An excluded track disappears and returns with its file intact.
- A deleted track is gone from storage after confirmation.

### v2 — Real library

Delivered:
- ID3 metadata enrichment in batches, cached in SQLite; filename titles remain
  the fallback when tags are missing.
- Albums and Artists tabs, albums sectioned by artist, album/artist detail pages
  with hero cover, title and counts.
- Search across title, artist and album, accent-folded.
- Recently played rail fed by real play history.
- Bottom tabs, one shared header, Settings sections, custom blue scrollbar, and
  a varied demo library for the web preview.

Data layer only:
- Playlists and favorites tables and repository functions exist; their UI is not
  built yet.

Dropped:
- Explicit badge: neither the metadata retriever nor jaudiotagger exposes a
  portable advisory flag; no badge ships.

**Acceptance**
- Albums/Artists reflect tags rather than filenames.
- Search matches title, artist and album.
- Recently played contains only tracks actually played.
- Playlists and favorites persistence are ready for their UI.

### v3 — Delight and ownership

Prerequisite: the `AudioPlaylist` migration that makes notification next/previous
work. The remaining v2 essentials (playlists, favorites, scan opt-in, hidden
restore, resume position) are part of this milestone, not prerequisites.

Library essentials:
- Playlists: create, rename, delete, add/remove tracks, up/down reorder, play a
  playlist as its own queue, persisted in SQLite.
- Favorites: `+`/heart toggle in Now Playing and the track action sheet, a Liked
  Songs list, persisted in SQLite.
- Scan: first-run opt-in ("Scan this device for audio?"), a Settings switch,
  and imports always visible.
- Hidden tracks return to Settings with Restore.
- Resume the last track and position after an app restart.
- Explicit badge: dropped. The tag writer exposes no portable advisory flag; the cache can store an explicit bit but no reliable source exists, so no badge ships.

Playback and listening:
- Notification and lock-screen next/previous must work. This ships with the
  `AudioPlaylist` migration in Task 1; the single `AudioPlayer` ignores them.
- Notification play/pause indicator must reflect the real playback state,
  with a valid small icon, action buttons and the track artwork as the large
  icon. A moving visualizer is not something Android MediaStyle supports; plan
  a static waveform glyph or drop it, not a fake animation.
- Shuffle: queue order snapshot vs random-next, with an explicit interaction
  rule for repeat one. Enabling preserves the current track; disabling restores
  the original order at the current position.
- Sleep timer: presets plus end-of-track, with a short fade before stopping.
- Gapless playback through `AudioPlaylist`. Crossfade is not exposed by
  expo-audio; drop it unless a second engine is explicitly wanted later.
- Lyrics: local `.lrc` sidecar first; if absent, look up LRCLIB
  (`GET /api/get`, no key) using title, artist, album and duration, with the
  required client User-Agent. Fetch only when the user opens lyrics, cache the
  result locally, honor `429 Retry-After`, and keep the app fully usable
  offline. Timed highlight and auto-scroll. LRCLIB is the only lyric source.
- Settings grows only when a feature actually exists.

Library ownership:
- Edit track tags in the file itself: title, artist, album, album artist,
  track/disc number, year, genre and artwork.
- Writes are atomic: temp file plus replace, then tags are re-read. A failed
  write leaves the original intact and reports the failure.
- Imported copies are always editable. Scanned files are editable only with
  write access; otherwise offer "import a copy and edit that".
- Track actions: long-press opens an in-app action sheet, never an Android
  `Alert`. Options: Details, Edit metadata, Rename, Exclude, Delete, Cancel.
  Delete uses a second in-app confirmation sheet. Settings bulk actions use the
  same sheet, so the app looks and behaves the same on Android and web.
- Catalog: Albums and Artists consolidated into one tab with a segmented control.
- Import becomes its own tab: local files move there from Settings, with a
  planned link-import section for YouTube-to-MP3 through the ytmp3.ge API.
- Batch edit is a stretch, not baseline.

Release packaging:
- The universal APK is about 76MB because it carries arm64-v8a, armeabi-v7a,
  x86 and x86_64 native libraries. The published phone build is arm64-only,
  about 24-25MB, and CI passes `-PreactNativeArchitectures=arm64-v8a`.
- The release notes name the ABI and record the APK size measured from the
  built artifact on the CI runner. No on-device install was performed for this
  task, so signature-over-previous-install remains unverified here.
- Universal builds stay for emulator/testing only:
  `cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86,x86_64 --no-daemon`.

Stretch:
- Android Auto / media browser.

### v4: Core experience (built)

Focus: make the everyday player trustworthy before adding discovery. The scope
is `docs/superpowers/plans/2026-11-15-v4-core-experience.md`. This section
records the code that is built; device verification is still open.

Built:
- Imports use `expo-document-picker` instead of `File.pickFileAsync`, because
  Android providers return document ids rather than filenames. Each imported
  file keeps a sanitized real name, gains a MIME-derived extension when the
  provider omits one, is validated as a non-zero copy, and is reported per file
  when it fails.
- Tag writes cover imported files and scanned files through a MediaStore content
  URI in the local Kotlin module. Every write is explicit, snapshot-backed, and
  followed by a re-read. A denied or read-only scanned file offers the copy
  fallback, and the original always stays playable.
- Back is one resolver: close the sleep panel, edit sheet, liked, playlist
  detail, playlists index, now playing, settings or search, then return a tab to
  Library. Exit arms only at the Library root and needs a second press within
  two seconds.
- Now Playing has a heart beside the sleep timer, persisted to Liked Songs.
- Playlists store a description and cover in schema v3. Cover fallback is the
  picked image, then the first track artwork, then the generated cover from the
  playlist name. The detail uses a shared collection hero with Play and Shuffle.
  Drag reorder uses `react-native-sortables` with persisted order and
  screen-reader Move up and Move down actions.
- Catalog is removed from the tab bar and routing for now. `CatalogScreen` and
  `groups.ts` stay on disk for a later redesign. Artwork hydration moved to
  `src/library/artwork.ts` so Library and Now Playing keep real art without
  Catalog's viewability callback.
- Link import is hidden. `LINK_IMPORT_ENABLED` stays false.

Removed or hidden, with reasons:
- **Catalog:** removed for now. The redesign is not settled, and an unused tab
  would expose a half-finished surface. The screen and grouping logic are kept
  for that redesign.
- **Link import:** hidden in v4. v5 wires the ytmp3.ge API.

Discovery is gated, not shipped. See
`docs/superpowers/plans/2026-11-15-v4-gated-expansion.md` and the per-source
memos in `docs/research/`. No source ships before its gate clears.

Device evidence for this milestone lives in
`docs/research/v4-device-check.md`. A device row is not a pass until it is run
on a device with recorded evidence.

### v4: Discovery (gated, not shipped)

Discovery is planned but not shipped. The gated plan
`docs/superpowers/plans/2026-11-15-v4-gated-expansion.md` holds the gate table
and task bodies. Research verdicts are recorded in `docs/research/v4-*-memo.md`.
Current state: Genius **defer** (credentials and restrictive terms), Radio
Browser **defer** (pending real-device AudioPlaylist playback), Audiometa.io
**defer** (account, terms and match sample missing). Shuffle stays
source-scoped. No v4 source ships until its memo is reviewed and its gate is
cleared.

Sources to evaluate:
- https://docs.genius.com
- https://publicapis.dev/resource/radio-browser/mdybs5l2
- https://publicapis.dev/resource/audiometa-io/wlceksvl

- **Genius** (`https://docs.genius.com`): song/artist metadata and annotations.
  Its public API does not serve lyrics for playback. Metadata enrichment only.
  Local `.lrc` stays the shipped lyrics source; LRCLIB is an optional v7
  exploration.
- **Radio Browser** (`https://api.radio-browser.info`): free, open internet-radio
  directory. If adopted, it is an opt-in separate section, not mixed into the
  local queue. Discover servers via DNS, identify the client with a User-Agent,
  report station clicks, and handle streams that fail or go offline.
- **Audiometa.io** (`https://www.audiometa.io`): REST metadata catalogue with
  artist/track data, ISRC, BPM, key and cross-platform playcounts. Needs an
  account API key; the catalogue is new and incomplete, so treat gaps as normal
  and cache aggressively.
- **Shuffle:** stays in v3 for local queues. v4 only explores a cross-source
  shuffle if internet radio ships.

Guardrails: every external feature is opt-in, the app still starts and plays
local files offline, requests identify the client, rate limits are honored,
responses are cached, and source attribution is visible. Local `.lrc` remains the
shipped lyric source; LRCLIB is an optional, off-by-default v7 exploration.

### v5: File ownership (built, device verification pending)

Focus: stop treating the audio file as truth. SQLite owns the name, artist, album,
artwork and tags; files are copied once into a user-chosen folder and never renamed
or tag-written. In-place tag editing is removed, which fixes the edit and rename
failures by elimination. Imports validate a non-zero copy instead of comparing
provider-reported size, which fixes the false "copy failed". Missing files are
detected before load and surface a warning with a delete call to action. Hidden
tracks gain their own Settings page with Clear (remove from the app, keep the file)
and Delete (remove the file). App-local tags get a filter bar above Recently played.
Import gains ytmp3.ge link import and loses the recent-imports list. Lyrics UI is
hidden behind a flag.

Built:
- Schema v4: `tracks`, `tags`, `track_tags` and `settings`; imports are migrated
  before cached metadata is folded; legacy track ids are preserved. The
  `track_metadata` table is kept unused for one release.
- `src/tracks`: ID helpers, row builders, repository with injected DB for tests,
  scan upsert that preserves overrides/status/tags, and a missing sweep that never
  touches owned rows. Removed tombstones stop a rescan from re-adding a cleared track.
- `src/storage`: chosen root via `Directory.pickDirectoryAsync`, flat names with
  ` (2)` suffixes, move/flatten, reclaimable space, and direct or cache-then-copy
  downloads. The SAF spike evidence is in `docs/research/v5-saf-spike.md`.
- `src/imports`: local import with a non-zero copy check, best-effort duration
  probe, dedupe/reactivation, shared probe module, and the ytmp3.ge converter.
- `src/tags`: create, assign, unassign, active-track counts and filtering.
- Player: files are resolved and validated before loading; dead entries are dropped;
  a failed load stops the engine and clears the window so the next play works.
- Screens: Settings (permission, scan summary, hidden row, exclude all, storage,
  sleep, About), Hidden tracks page, tag filter bar, tag editor, missing-file
  warnings with Clear/Delete, smaller Recently played, Import action surface, and
  the link card. Lyrics UI is gated by `LYRICS_ENABLED = false`.
- The local Kotlin `audio-tags` module and the tag-writer orchestration are removed.

Device checks still pending: upgrade over a real v3 install, SAF create/copy/delete/
move/download and persistence after relaunch, and a real ytmp3.ge download. These
are recorded, not assumed, and are listed in the plan closeout tasks.

Design: `docs/superpowers/specs/2026-11-16-krotify-v5-file-ownership-design.md`.
Plans:
- `docs/superpowers/plans/2026-11-16-v5-track-store-and-imports.md`
- `docs/superpowers/plans/2026-11-16-v5-player-hidden-settings.md`
- `docs/superpowers/plans/2026-11-16-v5-library-tags-and-link-import.md`

### v5.1: UX and playback reliability (planned)

Focus: make the v5 surfaces usable and make a bad download harmless.

- Settings and Hidden are layers. Settings appears instantly, with no slide
  transition. Hidden tracks slides in over Settings, and back closes Hidden to
  Settings without closing Settings.
- Link import uses a companion service shipped in `server/` and configured in
  Settings. The service is a small Express app over `yt-dlp`; it exposes video
  info and a best-quality MP3 download. The local import card expands to take more
  of the screen and uses a striped, drop-field border. There is no quality
  selector: the service always extracts the best audio.
- A link download is added only after its bytes are verified as audio. ytmp3.ge
  currently returns an HTML landing page (`ryin.info/...html`) as `downloadUrl`, so
  it is no longer used. An HTML or unplayable file is deleted, never inserted as a
  0:00 track.
- A bad or missing file is marked, stops and resets the audio engine, and the next
  track starts normally. One broken file cannot wedge playback.
- The hold menu loses Edit metadata and Rename. Details gains a pencil that toggles
  inline editing of title, artist, album, year, genre and artwork. Duration,
  format and file size stay visible and read-only.
- Now Playing gains tag controls and a save-to-playlist bookmark beside the sleep
  timer. The hold menu gains the same two actions.
- Tag editing is keyboard-safe: the editor scrolls so fields and chips are never
  obscured by the keyboard.
- Tag pills sit above the Liked Songs row, with a margin between them.

### v7: Local lyrics, artwork and UX polish (built, device verification pending)

Focus: bring lyrics back without the network, make real artwork drive color, and
tighten the surfaces a daily user touches. The UX review items below are part of
v7, not a later cleanup.

Built: local `.lrc` import and timed panel behind `LYRICS_ENABLED`; a local
AndroidX Palette module for the ambient backdrop; a square cropper on track and
playlist art; a Library reduced to songs and tag pills with a Collections header
entry; the playlist cover grid, inline create and per-card menu; Settings tag
management; hidden link import; the About Tech stack page and credit; per-layer
tab-bar blur targets; and the Playwright regression suite. LRCLIB, Artists and
the Home-style section are not shipped.

- **Lyrics, local first.** `LYRICS_ENABLED` returns. Now Playing gets a lyrics
  mode and an Import .lrc action. Picking a local `.lrc` reads and parses it, then
  stores the text in `lyrics_cache` for that track. Local lyrics always win.
  Timed highlight, auto-scroll and tap-to-seek return. If a track has no local
  lyrics, the panel offers Import .lrc.
- **LRCLIB exploration.** Evaluate an optional, opt-in network lookup against
  `https://lrclib.net/docs`. Local `.lrc` remains the default and the baseline
  release; LRCLIB is not required. The exploration covers `GET /api/get` with
  title, artist, album and duration, plus `/api/search` or the beta
  `/api/v2/search` for lookup, client identification through `User-Agent`,
  sequential requests with a short delay, honoring `429`/`Retry-After`, and
  caching results locally. No publish, flag or bulk prefetch. If adopted, it is
  off by default with a Settings toggle and sends only title, artist, album and
  duration. Findings and the gate live in
  `docs/research/v7-lrclib-exploration.md`.
- **Ambient color from the art.** The Now Playing backdrop uses the dominant color
  of the real cover, cached per artwork URI. The generated hue is only a fallback
  when there is no real art or extraction fails.
- **Library is the song list.** The Library lists every song plus the tag pills,
  nothing else. The Recently played rail, the Liked Songs row and the Playlists
  rail leave the Library in v7. A compact Collections control in the header keeps
  Liked Songs and Playlists reachable until they return with Artists in a
  dedicated Home-style section, which is out of scope here. No Artists rail in
  v7. Screens and routes stay on disk for that section.
- **Library song rows.** Each row shows cover, title and `artist · duration` on the
  second line. An ellipsis button on the right opens the same action sheet as a
  long press. Duration leaves the far right.
- **Square art cropper.** A reusable cropper with pinch zoom, pan, resize and a
  square selection applies to track and playlist art. The result is saved as a new
  square image in the app artwork folder and its URI is stored in the DB. Audio
  files are never touched. Artist art joins when the artists surface lands.
- **Active-page navbar blur.** The tab bar blurs the active page. Settings,
  Hidden tracks, Search, Playlists, Liked Songs and Details each provide their own
  blur target, so Settings no longer shows the blurred Library underneath.
- **Playlists revamp.** The index becomes a two-column cover grid with a prominent
  Create action, per-card overflow (edit, delete), a track count and an empty
  state. Detail keeps the hero, cover editing through the cropper, Play, Shuffle,
  drag reorder and the persistent bottom nav/player.
- **Playlist picker revamp.** The picker used by the hold menu and the Now Playing
  bookmark gains two things:
  - a New playlist row with a name field; pressing Add creates the playlist and
    adds the current track in one step;
  - multi-select checkboxes, so one Add press adds the track to every checked
    playlist and reports "Added to N playlists". Partial failures are named, not
    silent.
- **Tags in Settings.** A Tags section lists every tag with its active track
  count, creates a tag with the same validation as the editor, and deletes a tag
  after confirmation. Deleting removes its `track_tags` rows so it disappears from
  every song. Audio files are never touched. The track editor keeps its own
  create-and-assign flow.
- **Import surface trimmed.** The YouTube link card is hidden from Import and the
  link-service section is hidden from Settings. Keep the code behind
  `LINK_IMPORT_ENABLED = false`; no route, no dead fields, no broken import path.
- **About: tech stack and credit.** The version string in About is tappable and
  opens a Tech stack page listing the stack from the table above. About and the
  Tech stack page both carry a "Created by Krocified" watermark.
- **Hidden tracks row.** The Settings row drops its trailing track count; the
  Hidden tracks page keeps the count.

## Library management

Two sources, one list.
- **Scan**: device audio except ringtones, notifications, alarms and UI sounds,
  and except files under 3s. Files are referenced in place with a resolved URI.
  `expo-media-library` permission; denial falls back to imports, then demo.
- **Import**: system file picker, copied into app storage. Already-imported files
  are skipped by source name + size, never duplicated. Imports bypass the scan
  filter.

**Exclude vs delete**
- Exclude is app state only: store the track in the AsyncStorage exclusion list,
  filter it out of every list and the player queue. Undo is one tap, file
  untouched. Settings can exclude all scanned tracks at once.
- Delete is destructive: confirm in a dialog that names the track, then call
  `Asset.delete(assets)` for scanned media (Android shows its own system
  confirmation) or `File.delete()` for imported copies. (`deleteAssetsAsync` is
  deprecated and throws in SDK 58.) Also delete the track's rows (favorites,
  playlists, history, exclusions). Never delete a file
  the app did not import unless the user explicitly hit delete.

## Settings

Sectioned into Library (rescan, import, exclude all), Hidden tracks (restore),
and About (version from `app.json`). Tabs and the mini-player remain visible
while Settings is open.

## External services

- **LRCLIB** (`https://lrclib.net/docs`): v7 exploration for an optional,
  off-by-default network lyric lookup. Local `.lrc` is the baseline and always
  wins. Use `GET /api/get` with title, artist, album and duration; use
  `/api/search` or beta `/api/v2/search` for matching; identify with a
  `User-Agent`; send requests sequentially with a short delay; honor
  `429`/`Retry-After`; cache results. No publish, flag or bulk prefetch. It ships
  only after the exploration gate clears.
- **Genius**, **Radio Browser**, **Audiometa.io**: v4 exploration only, each
  behind an opt-in surface with its own terms, rate limits and attribution.
- **Self-hosted link service** (v5.1): a companion Express app in `server/` runs
  `yt-dlp` on the user's machine or server. `GET /info/:videoId` returns title,
  thumbnail and duration; `GET /video/:videoId` returns a best-quality MP3. The app
  stores the service base URL in Settings, downloads into the chosen storage
  folder, verifies the bytes are audio, and never adds an HTML or unplayable file.
  ytmp3.ge is retired because its `downloadUrl` returns an HTML page.

## Screens & flows

**Tabs**: Library and Import. Persistent on every page except Now Playing:
Library, Import, Settings, Hidden tracks, Search, Playlists, Liked Songs and track
details. A floating blur pill above the system inset; active tab uses a filled
icon and white label, inactive uses an outline icon and dim label. Settings stays
in the header.

**Catalog (removed for now)**: The Albums/Artists tab and its routing are gone.
`CatalogScreen` and `groups.ts` stay on disk for a later redesign. Artwork
hydration runs from the library after metadata enrichment so Library and Now
Playing keep real covers.

**Library** — shared header (`Krotify` wordmark, search, settings), tag filter
pills above a Liked Songs row with a margin between them, a playlists rail, an
Artists rail, optional Recently played rail, and the track list. Song rows show
cover, title, `artist · duration`, and an ellipsis button that opens the same
action sheet as a long press (details, tags, save to playlist, favorite, exclude,
delete). Scrolling shows a thin blue scrollbar from below the header to the
mini-player.

**Catalog / Albums (unwired)**: kept for the later redesign. Segmented control;
artist section headers; rows with cover, album title, and "N tracks · M min".
Album detail has a back pill, hero (160px cover, title, artist, count), then the
track list.

**Catalog / Artists (unwired)**: kept for the later redesign. Circular covers,
artist name, "N albums · M tracks". Artist detail mirrors the album detail with
a circular hero.

**Playlists**: a two-column cover grid with Create, per-card overflow (edit,
delete), count and an empty state. Detail keeps the hero, cover editing through
the cropper, title, description, meta, Play and Shuffle. Rows drag to reorder with
auto-scroll, and the order persists and matches playback. Entry from Library. The
bottom nav and mini-player stay visible.

**Liked Songs** — favorites list with the same rows and action sheet.

**Track details** — reached from the action sheet or the Now Playing info button.
Shows cover, title, artist, album, album artist, track/year, disc, genre,
duration, format and file size. A pencil in the header toggles inline editing of
title, artist, album, year, genre and artwork only; duration, format and file size
stay read-only. Edit metadata and Rename are no longer separate menu items.

**Artist detail** — circular hero art, artist name, `N albums · M tracks`, and the
artist's track list. The artist art can be replaced and cropped. Reached from the
Library Artists rail.

**Import**: a dedicated tab, not a Settings row. The local import card expands to
take most of the screen and uses a striped drop-field border. System document
picker with per-file failure reasons, progress, empty and error states. There is
no recent-imports list; a successful import returns to Library. Link import always
requests 320 kbps, posts to the ytmp3.ge API, verifies the downloaded bytes are
audio, and downloads into the chosen storage folder.

**Search** — slide-in overlay with a borderless field (accent cursor) and
incremental results across title, artist and album.

**Now Playing** — plain back/down control aligned with the other back pills, no
black pill. The backdrop is the dominant color of the real cover, dimmed; the
generated hue is only a fallback. Draggable progress with previous/play/next
centered on play and repeat at the right. The transport row holds details, tags,
a save-to-playlist bookmark, the heart and the sleep timer. Lyrics mode returns
with local `.lrc` only: an Import .lrc action, timed highlight, auto-scroll and
tap-to-seek. Local `.lrc` is the baseline; an optional LRCLIB lookup is an
off-by-default exploration. Closing is instant and returns to the screen it was
opened from.

**Mini-player** — floating card inset from the edges, radius 4, 2px inset
progress line, cover, title, artist, close and play/pause. It stacks above the
tabs and is never dimmed by their fade. Horizontal swipe slides only the content
and moves to the next or previous track with queue wrap; vertical swipe does
nothing; the bar itself never moves. Closing the song page returns to this card
at the current position with no slide.

**Settings** — an instant page, sectioned into Library (permission, scan, rescan,
exclude all), Storage, Playback, and About. Hidden tracks is a separate layer that
slides in over Settings; back returns to Settings with Settings still open. Tabs
and the mini-player stay available, and the tab-bar blur samples Settings itself.
There is no network lyrics setting; lyrics are imported on the song page.

## Visual design system

Art is the product. The chrome stays quiet so covers carry the screen.

**Color**
| Token | Value | Use |
|-------|-------|-----|
| `bg` | `#0B0B0F` | App background |
| `surface` | `#16161D` | Cards, list rows |
| `surfaceHi` | `#1F1F29` | Pressed / raised |
| `text` | `#F5F5F7` | Primary text |
| `textDim` | `#9A9AA8` | Secondary text |
| `accent` | `#215BED` | Krotify blue: active state, progress |
| `accent2` | `#6E9BFF` | Light blue: gradients, secondary highlights |
| `accentBright` | `#3D74FF` | Slider fill and glow: brighter than accent |

**Type** — system font. Display 28–32/700 for titles, 16/600 body, 13/500 dim
metadata. Tabular numerals for durations.

**Cover art** — follows Spotify art rules: original form, never cropped, never
overlaid, never distorted, animated or blurred.
- Real art when available (v2). Otherwise generate a deterministic gradient from
  the album/title hash — two hues blended diagonally, a soft grain overlay, the
  album's initial in 800-weight white at 40% opacity. Generated art is ours, so
  it may also carry the grain.
- 1:1, 4px radius on phone, 8px on large screens, subtle outer shadow.
- Now Playing backdrop = the dominant color extracted from the current cover,
  dimmed to ~35% (`#191414` fallback), filling the screen behind the content. The
  generated hue is only a fallback when there is no real art. No blur of real art.
- No logo, wordmark or playback controls on top of artwork.

**Metadata** — always legible, never manipulated; truncate with ellipsis and let
the full value be reachable. Layout budget: album 25 chars, track 23, artist 18.
Explicit tracks get a badge next to the title (v2, when the tag exists).

**Brand separateness** — krotify's name, logo and accent must not resemble
Spotify's: no Spotify Green, no circle-and-waves mark, no co-branding.

**Tab bar** — a floating blur pill: 16px side margins, 12px above the system
inset, 64px tall, fully rounded, `expo-blur` over a translucent `surface` fill
with a 1px `#ffffff14` border and a soft shadow. No gradient fade and no top
border. Content scrolls underneath. Active tab: filled icon and white label;
inactive: outline icon and dim label. The mini-player floats above the pill.

**Scrollbar** — thin accent-blue thumb on a faint track, right edge, active only
while scrolling, 37.5% of the proportional length, widens to 6px while held or
hovered, draggable. Runs from below the header to the mini-player bottom.

**Motion** — Now Playing opens with a 300ms ease-out slide; closing is instant.
Album/artist detail and tab changes are instant. Settings slides in/out over
280ms. Progress glides 500ms while playing, snaps on track changes and swipes.
List rows use a light press-scale. No gratuitous bounces.

## Data model
```ts
type Track = {
  id: string;
  uri: string;          // file:// on device; empty for demo tracks
  source: 'scan' | 'import' | 'demo';
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  trackNumber?: number;
  year?: number;
  genre?: string;
  durationMs: number;
  artworkHue: number;   // seed for generated cover when no real art
  artworkUri?: string;
};
type PlayerState = {
  queue: Track[];
  index: number;
  isPlaying: boolean;
  positionMs: number;
  repeat: 'off' | 'all' | 'one';
};
```

SQLite tables (`krotify.db`, `PRAGMA user_version` migrations):
- `tracks`, `tags`, `track_tags`, `settings` (v5); tracks hold the display
  metadata, artwork URI and app state.
- `playlists` (name, description, artworkUri), `playlist_tracks` (gap-numbered
  positions)
- `favorites`
- `play_history`
- `lyrics_cache` (local `.lrc` text keyed by track; no network source)
- `artist_art` (`artistKey`, `artworkUri`, `updatedAt`) for cropped artist art
- `artwork_colors` (cache of dominant color per artwork URI)

## Demo data
Ten in-memory tracks across four artists and five albums (Mira Vale with two
albums, Kite Season, Low Meridian, Sable & Ash), with distinct hues and tag
fields, so Albums, Artists and Search are meaningful in the web preview. Demo
tracks are the only fallback; no fake play history and no fictional real-world
claims.

## Decisions
- Fonts: platform default sans (Helvetica Neue → Helvetica → Arial as fallback),
  per Spotify's font guidance. System fonts through v2; wordmark can get its own
  face later.
- Accent: krotify blue `#215BED` confirmed. Spotify Green is off-limits — brand
  separateness rules forbid resembling their mark or color.
- Recently played: never seeded; the rail shows real history only.
- Scan: all device audio except ringtones, notifications, alarms and UI sounds,
  and except files under 3s. Imports bypass the filter. Rescan from Settings.
- Settings: sectioned into Library, Hidden tracks and About; options exist only
  for shipped features.
- Shuffle: deferred past v2.
- Metadata: ID3 tags via `@missingcore/react-native-metadata-retriever`, cached in
  SQLite; filename titles remain the fallback. Embedded art loads lazily and is
  propagated to every screen that shows the track.
- Navigation: state-based tabs in `AppShell` (Library and Import), not
  expo-router. Catalog is removed for now. Settings and Search are overlays with
  slide transitions.
- Search: incremental, accent-folded, across title/artist/album.
- History: play history deduped by track, most recent first.
- Tagless tracks: keep the filename-derived title; never hide a playable file.
- Excluded tracks: surfaced in Settings under Hidden tracks with Restore.
- Scrollbar: custom accent-blue thumb, active only while scrolling, draggable,
  ends level with the bottom player.
- Grain: still deferred; covers are gradient plus initial when no real art.
- Version: 0.3.1 (`versionCode` 301). Releases `v0.1.0` through `v0.3.1` exist;
  `.github/workflows/release.yml` bumps and publishes on every push to `main`.

## Remaining after v2

1. **Notification next/previous.** A single `AudioPlayer` ignores these commands
   (`supportsNextTrack = false` in expo-audio). Move the audio engine to
   `AudioPlaylist` with a resolved window around the current track, `skipTo` for
   app buttons, `trackChanged` to sync index/track, and
   `showNextTrack/showPreviousTrack: true`. Rebuild the window at its edges; mock
   demo playback keeps its own timer.
2. **Scan opt-in.** First launch asks "Scan this device for audio?" with Scan and
   Not now. Persist in AsyncStorage (`krotify.scanEnabled.v1`), expose a Settings
   switch, and keep imports visible regardless. Folder-level scanning is not
   possible with `expo-media-library`.
3. **Playlists UI.** The SQLite repository exists. Build create/rename/delete,
   add/remove tracks, and up/down reorder on top of it.
4. **Favorites UI.** Table and repository exist. Add the `+`/heart toggle with
   "Added to Liked Songs" feedback and a Liked list.
5. **Explicit badge.** Dropped: neither the metadata retriever nor jaudiotagger
   exposes a portable advisory flag. The cache column remains for a future
   source.
6. **Real-art backdrop.** Now Playing still derives its backdrop from the hash
   hue; extract color from `artworkUri` when available.
7. **Build note.** `@missingcore/react-native-metadata-retriever` bundles a
   Media3 fork that collides with expo-audio; `plugins/with-media3-exclude.js`
   excludes the fork and must stay in `app.json` plugins before prebuild.

## Open decisions

**After v2**
- Playlist reorder: up/down buttons now; decide whether drag is worth a gesture
  library later.
- Artwork color extraction for the Now Playing backdrop: pick a library or a
  native palette module before adding a dependency.
- Resume position across app restarts.
- Playlist/favorite sync if a second device ever exists (currently non-goal).

**v3**
- Shuffle semantics: reorder the queue once, or pick a random next each time?
  How does repeat-one interact?
- Crossfade is not exposed by `expo-audio` (gapless is, via `AudioPlaylist`).
  Drop crossfade, or accept a second playback engine just for it.
- Sleep timer: hard stop, fade out, or stop at end of track.
- Distribution: release-signed APK now, or ship debug builds until the app
  settles.

**v3 editing**
- Tag writer: no tag-writing library is in the stack. Plan assumes a small local
  native module backed by jaudiotagger; confirm or replace during the spike.
- Write access to scanned files: `MediaStore.createWriteRequest` per selection
  vs restricting edits to imported copies.

- Web preview: `npx expo start --web` (or `npx expo export --platform web`) serves a
  demo-only surface — demo library plus mock playback — so people on iOS or a
  laptop can try the UI. Scanning, background audio and notification controls
  remain Android-only.
