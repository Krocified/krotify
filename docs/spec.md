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
| Artwork picker | `expo-image-picker` (v8) | System photo picker for gallery covers; no camera or microphone permission |
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
section for Liked Songs, Playlists, Artists and Albums; the playlist cover grid,
inline create and per-card menu; Settings tag management; hidden link import; the
About Tech stack page and credit; per-layer tab-bar blur targets. LRCLIB is not shipped.

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
  when there is no real art or extraction fails. The static color is the base that
  v8's ambient motion builds on.
- **Library is the song list.** The Library lists every song plus the tag pills,
  nothing else. The Recently played rail, the Liked Songs row and the Playlists
  rail leave the Library in v7. A Collections control in the header opens a
  section with Liked Songs, Playlists, Artists and Albums; artist and album
  detail use the existing grouping helpers. No artists rail inside the Library
  body.
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

### v8: Everyday gestures (built, device verification pending)

Focus: make the gestures a daily user repeats trustworthy — selection, import,
artwork, playlists, artist pages and the player — before adding another surface.
One new screen (the playlist song picker); everything else is a fix or a
completion of something already shipped.

- **One selection indicator.** Starting a selection never reshapes the top
  header. The header keeps its wordmark or back pill, its title and its normal
  trailing controls; the selection bar under it is the only place for the count,
  the actions and Cancel. This replaces the current double indicator (count in
  the header plus count in the bar) on Library, Hidden tracks and Tags.
- **Back exits selection.** Android back, while a selection is active on Library,
  Hidden tracks or Tags, clears the selection and stays on the screen. It does
  not close the page, change tab or arm app exit. A sheet opened from a
  selection still closes first. Selection is screen-owned state reported to the
  shell's existing back interceptor; predictive back stays off.
- **Selection actions grow up.** Library selection keeps Hide and Delete and
  gains Tag and Add to playlist. Hidden tracks keeps Restore, Clear and Delete.
  Tags keeps Delete.
  - Tag opens the tag picker in bulk mode. Each tag toggles on or off for every
    selected track in one pass, and the toast reports "Tagged N tracks" or
    "Removed from N tracks". A new tag can be created and assigned in the same
    sheet, with the track editor's validation.
  - Add to playlist opens the playlist picker in bulk mode. Selected tracks are
    appended in library-list order to every checked playlist, creating a new
    playlist inline works as it does for one track, and the toast reports
    "Added N tracks to M playlists". A per-playlist partial failure is named,
    not silent.
  - Actions are disabled at zero selected. The action row scrolls horizontally
    when the labels do not fit; nothing hides behind a second overflow menu.
  - The mode survives scrolling and tag filtering. Deselecting the last track
    stays in selection at "0 selected" until Cancel or back, so a mis-tap does
    not drop the mode.
- **Import: one copy, honest progress.** The complaint is both ends: the system
  picker feels slow and clunky, and the wait after picking is invisible.
  - Pick without the cache copy (`copyToCacheDirectory: false`) and copy once
    into the storage folder. Today every pick is written twice — once to cache,
    once to storage — and that doubling is most of the wait for album-sized
    files.
  - Report as it goes: a determinate bar, "Importing 3 of 12 — Song.mp3", the
    current file name and a Cancel that stops after the file in flight. Rows
    appear in the library as each file lands instead of after the whole batch.
  - Tag reads are batched per pick in one native call before copying (the
    metadata retriever exposes no duration). Duration and embedded artwork run
    after the row is inserted, one file at a time: the row lands at 0:00 with the
    generated cover, then fills in. A file whose duration cannot be read stays
    playable and never blocks the next file.
  - Duplicate, hidden and failure reports keep their current per-file reasons.
    A cancelled import keeps what already landed.
  - The system picker stays. There is no in-app file browser: "slow" is answered
    by removing the second copy and by progress, not by replacing Android's
    picker.
- **Artwork from the gallery.** Track artwork and playlist covers each offer two
  sources before the cropper: Gallery and Files. Gallery uses `expo-image-picker`
  with `mediaTypes: ['images']`, no editing and quality 1, which opens the system
  photo picker; Files keeps the document picker. Both feed the same square
  cropper and the same app-owned artwork file; audio files are never touched. The
  config plugin blocks `CAMERA` and `RECORD_AUDIO`.
- **Cropper that matches its preview.** The saved square is the square in the
  frame at every zoom and edge pan, for wide, tall and already-square sources.
  One model — intrinsic size, fitted display size, zoom, offset — drives both the
  preview and the crop rectangle, so the two cannot drift; the saved offsets come
  from the settled transform, not a stale JS copy. Reset returns to fit. Failures
  say which step failed (read the image, crop it) instead of one generic message.
  Verified against a wide photo, a tall photo, a square photo, a 1x crop, a
  zoomed crop and an edge-pan crop.
- **Notification player you can trust.** The media notification always shows
  artwork, title and artist, working transport and a seek bar with elapsed and
  remaining time: after a cold start, after next or previous from the app or the
  notification, after the queue window is rebuilt, and after returning from
  background. Device acceptance: the bar is present on the first track after a
  cold start without touching anything, timestamps advance, scrubbing in the
  notification moves playback, and the bar is correct for both a five-minute
  track and a thirty-second track. Diagnosis first, then fix: confirm a local
  file is never reported as a live stream (that option hides the bar), confirm
  the session knows the duration when the first notification posts, re-assert the
  lock-screen state once when a loaded duration first appears rather than on
  every tick, and stop rebuilding the engine while a notification is live.
- **Sheets stay above the keyboard.** No text field is ever under the keyboard.
  The shared bottom sheet lifts so the focused field, its hint and its submit row
  stay visible, capped below the top inset, and long content scrolls inside the
  shorter sheet instead of hiding the field. This covers New playlist, Edit
  playlist, Paste lyrics, the tag picker and the playlist picker's inline New
  playlist row. The fix lives in the shared sheet, so a new sheet inherits it. A
  sweep verifies every text field in the app: sheets lift, and full-screen
  editors (track details, Settings link service) keep the field and the submit
  action visible. A hidden field is a bug, not a scrolling problem.
- **A quiet playlist menu.** The playlist card overflow drops its black filled
  circle: a bare ellipsis at 18–20px with the same 44px invisible hit target, dim
  by default and brighter while pressed. It never competes with the cover.
- **Build a playlist from the library.** Playlist detail gains Add songs, which
  opens the new full-screen song picker over the playlist. It is a checkbox list
  of the whole library with the Library's search field and tag pills, so a
  playlist can be assembled by search or by tag without leaving it. Rows already
  in the playlist read as added and cannot be selected. The confirm action reads
  "Add N songs" and appends in the order shown. Back and Cancel leave the
  playlist unchanged.
- **Artist detail is a place.** Back from an artist returns to Collections with
  the Artists list where it was; back from Collections still returns to Library.
  The artist hero cover can be replaced by tapping it: Gallery or Files, then the
  same square cropper as tracks and playlists. Artist art persists in
  `artist_art`, keyed by the normalized artist name, survives a rescan, and shows
  in the Artists list; the first track's art is the fallback and "Use default"
  restores it. Album counts leave artist surfaces: the list row and hero read
  "N songs", with no album mention.
- **Select all, unselect all.** Every selection has one all-control at the
  leading edge of the selection bar, shaped like a MUI checkbox: checked when
  every visible row is selected, mixed when some are, empty when none. Pressing
  it selects every visible row — scoped to the active tag filter or search query
  — or clears the selection when all visible rows are already selected. The
  label and accessibility state follow ("Select all", "Unselect all", mixed).
  Disabled and already-added rows are never included.
- **Player controls: two, then more.** The Now Playing top-right keeps only the
  heart and the lyrics toggle. Sleep timer, Tags, Save to playlist and Details
  move behind one expand control that opens a compact labelled row; it collapses
  on choose, on tap-away and on back. An active sleep timer shows only a small
  "Sleep · 12:34" caption near the transport, so it stays visible without being a
  control. The sleep timer feature stays; it leaves the player's primary row.
- **Lyrics mode is the lyrics.** Lyrics mode stops being a second full player.
  The large cover and the floating two-line title block give way to a compact
  header row — a 48px rounded cover, title and artist on one line each — so the
  transcript gets the height. Paste leaves the empty state: Import .lrc, Paste
  lyrics and Reload move into an overflow on the lyrics header, and the empty
  state keeps a single Import .lrc action. Timed highlight, auto-scroll and
  tap-to-seek stay. Artwork mode keeps the large cover, with title and artist in
  one left-aligned block under it instead of centered floating text.
- **Not in v8.** No new navigation model and no new tabs; the playlist song
  picker is the only new screen. No custom notification layout. No in-app file
  browser and no folder-recursive scan. No change to what an import or a delete
  does to files. No removal of the sleep timer feature.

### v8.1: Feedback pass (built, device verification pending)

Focus: close the gaps the 0.8.0 feedback found without adding a new surface.
Targets version 0.8.1 (`versionCode` 801).

- **Ambient moves whenever the player is visible.** The backdrop animates while
  paused as well as while playing; it only stops when the app is backgrounded or
  reduce-motion is on. Three seeded pools drift further and faster than v8 —
  a 24–48s cycle instead of 60–120s, with a scale pulse and opacity breathing —
  so the motion is visible on a short look. Colors still come from the cover's
  dominant color, with the generated hue as the fallback. The same track always
  uses the same seed; animation stays on the native driver and cover art never
  moves.
- **The player overflow is a quiet icon popover.** The expand control opens a
  compact popover of icon-only buttons (sleep timer, tags, save to playlist,
  details), each a 44px target with an accessibility label; labels leave the
  visible UI. The popover is absolutely positioned below the top row, so opening
  it never moves the back/down pill on the left or reflows the stage. It still
  collapses on choose, on tap-away and on back.
- **Selection actions are visible and include Like.** The Library selection bar
  always shows its actions beside the count and Cancel; the horizontal action
  strip no longer collapses to zero width. Library selection offers Like or
  Unlike (bulk add to or remove from Liked Songs, reporting the count), Tag,
  Playlist, Hide and Delete. The same bar width fix applies to Hidden tracks,
  Tags and the playlist song picker.
- **Sheets shrink instead of overflowing above the keyboard.** The sheet body's
  ScrollView shrinks to the panel's measured height before it scrolls, so the
  focused field and the submit row cannot render past the lifted panel and under
  the keyboard. After the keyboard opens, the sheet scrolls the focused field
  into view and falls back to scrolling to the end. New playlist, Edit playlist,
  Paste lyrics, the tag picker and the playlist picker all inherit the fix.
- **Notification pause and app state agree.** Pausing from the notification and
  then opening the app keeps the paused state and still lets Play start playback.
  On return to the foreground the provider re-asserts the audio mode, asks the
  native playlist to re-emit its status so `playing` and position are current,
  and re-applies lock-screen metadata. A Play press that does not start within
  half a second reloads the current window at the current position and plays,
  instead of leaving a dead player.
- **The notification carries progress.** The media notification posts a
  determinate progress bar from the player's position and duration and refreshes
  it once a second while playing. This is a native patch through a config plugin,
  so it survives `expo prebuild --clean`; it is present for both a five-minute
  and a thirty-second track. No custom expanded notification layout is added.
- **Not in v8.1.** No new screens, navigation or dependencies. No change to the
  audio files, tags or the import path. The sleep timer stays. Device checks for
  the notification bar, keyboard lift and ambient motion are recorded in
  `docs/research/v8-device-checks.md`.

### v8.2: Second feedback pass (built, device verification pending)

Focus: make the second round of 0.8.1 feedback land without new crashes.
Targets version 0.8.2 (`versionCode` 802).

- **No ambient crash.** The backdrop owns exactly as many animated values as
  `ambientTheme` produces (`AMBIENT_POOL_COUNT`) and skips a pool rather than
  reading an undefined value. This is the 0.8.1 crash when the player opened.
- **Sheets anchor to the keyboard top.** The shared sheet measures the keyboard
  top from `endCoordinates.screenY` as well as its height, so it lifts to the
  keyboard top whether the Android window resized or not, without double-lifting.
  After the keyboard opens it also scrolls the sheet to the end so the focused
  field and its submit row are visible even when the field is at the bottom of a
  long sheet.
- **Library settings is its own page.** Settings keeps Tags, Storage, Playback
  and About. A Library settings row opens a page owning Permission (+ Grant),
  Scan this device, Rescan, Hidden tracks and Exclude all scanned tracks. Back
  from it returns to Settings; Hidden tracks remembers it came from Library
  settings and returns there.
- **Liked Songs supports bulk and swipe.** Long-press starts a selection with
  the same count/select-all/Cancel bar as Library, plus a destructive Remove
  action that unlikes every selected song. Swiping a row left reveals a red
  trash action; only one row is open at a time, swiping right or touching
  elsewhere closes it, and the trash opens the existing confirmation sheet
  before anything changes. Swipe is disabled while selecting.
- **The playlist detail is compact.** The playlist hero is a 92px cover beside
  the name, description and count. Play, Shuffle, Edit and Add songs move into
  one 44px action row instead of a full-width hero action block. Queue play,
  shuffle, cover/name editing, the song picker, drag reorder and per-row remove
  are unchanged.
- **Blur pills are a shared component.** `BlurPill` wraps the tab bar's glass
  recipe — target-backed `BlurView`, translucent fill, hairline border,
  overflow-clipped radius — for reuse. Player primary and overflow buttons and
  the library tag chips use it; a selected tag keeps the accent fill. Missing
  targets degrade to the translucent fill, never a crash.
- **Not in v8.2.** No new third-party dependencies. No change to audio files,
  tag storage or the import path. No custom notification layout. Device checks
  for keyboard anchoring, swipe rows, the settings split and blur pills are
  recorded in `docs/research/v8-device-checks.md`.


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
pills, a Collections control (Liked Songs, Playlists, Artists, Albums) and the
track list. Song rows show cover, title, `artist · duration`, and an ellipsis
button that opens the same action sheet as a long press (details, tags, save to
playlist, favorite, exclude, delete). Scrolling shows a thin blue scrollbar from
below the header to the mini-player. A long press starts a selection; the header
does not change, the selection bar carries the count, Hide, Delete, Tag, Add to
playlist and Cancel, and Android back cancels the selection.

**Catalog / Albums (unwired)**: kept for the later redesign. Segmented control;
artist section headers; rows with cover, album title, and "N tracks · M min".
Album detail has a back pill, hero (160px cover, title, artist, count), then the
track list.

**Catalog / Artists (unwired)**: kept for the later redesign. Circular covers,
artist name, "N albums · M tracks". Artist detail mirrors the album detail with
a circular hero.

**Playlists**: a two-column cover grid with Create, per-card overflow (edit,
delete), count and an empty state. The card overflow is a bare ellipsis, no filled
circle. Detail keeps the hero, cover editing through the cropper, title,
description, meta, Play, Shuffle and Add songs. Add songs opens the full-screen
song picker: checkbox rows over the whole library with search and tag pills,
Select all, and "Add N songs". Rows drag to reorder with auto-scroll, and the
order persists and matches playback. Entry from Library. The bottom nav and
mini-player stay visible.

**Collections** — a card with Liked Songs and Playlists, then the Artists list
with circular covers ("N songs") and a search/settings header. Opening an artist
shows a circular hero, the artist name, "N songs", Play, Shuffle and the artist's
track list; the hero can be tapped to change the artist cover. Back from an
artist returns to Collections; back from Collections returns to Library.

**Liked Songs** — favorites list with the same rows and action sheet.

**Track details** — reached from the action sheet or the Now Playing info button.
Shows cover, title, artist, album, album artist, track/year, disc, genre,
duration, format and file size. A pencil in the header toggles inline editing of
title, artist, album, year, genre and artwork only; duration, format and file size
stay read-only. Edit metadata and Rename are no longer separate menu items.

**Artist detail** — circular hero art, artist name, `N songs`, and the artist's
track list. No album count or album grouping. Tapping the hero lets the user pick
art from the gallery or files and crop it square, with Use default to fall back
to the first track's art. Reached from Collections; back returns to Collections.

**Hidden tracks** — a layer over Settings that slides in and keeps the count in
its header. Multi-select offers Restore, Clear and Delete. The header keeps its
back pill and title during a selection; the selection bar is the only count and
Cancel, and Android back exits the selection instead of closing the layer.

**Tags** — its own layer over Settings. Lists every tag with its active track
count, creates a tag with the editor's validation, and deletes one tag or many
after confirmation. Multi-select offers Delete. The header keeps its back pill
and title during a selection; the selection bar is the only count and Cancel, and
Android back exits the selection instead of closing the layer.

**Import**: a dedicated tab, not a Settings row. The local import card expands to
take most of the screen and uses a striped drop-field border. The system document
picker is the only picker. Picks are copied once, straight into the storage
folder, and the screen reports a determinate progress bar, "Importing 3 of 12 —
Song.mp3" and a Cancel that stops after the file in flight, with rows appearing
as files land. Per-file duplicate, hidden and failure reasons are kept. There is
no recent-imports list; a successful import returns to Library. Link import is
behind `LINK_IMPORT_ENABLED` and, when enabled, posts to the self-hosted link
service, verifies the downloaded bytes are audio, and downloads into the chosen
storage folder. A web page is never added as a track.

**Search** — slide-in overlay with a borderless field (accent cursor) and
incremental results across title, artist and album.

**Now Playing** — plain back/down control aligned with the other back pills, no
black pill. The backdrop is a slow ambient field built from the cover's palette,
seeded per track; the static dominant color is the first paint, and the generated
hue is the no-art fallback. Cover, then a left-aligned title and artist block, then
draggable progress with previous/play/next centered on play and repeat at the
right. The top-right holds only the heart and the lyrics toggle; an expand control
opens a labelled row with Sleep timer, Tags, Save to playlist and Details. An
active sleep timer appears only as a small "Sleep · 12:34" caption near the
transport. Lyrics mode compacts the header to a 48px cover with title and artist on
one line each, hands the height to the transcript, and keeps Import .lrc, Paste
lyrics and Reload in the header overflow; timed highlight, auto-scroll and
tap-to-seek stay. Local `.lrc` is the baseline; an optional LRCLIB lookup is an
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
overlaid, never distorted, animated or blurred. The ambient backdrop is not the
art.
- Real art when available (v2). Otherwise generate a deterministic gradient from
  the album/title hash — two hues blended diagonally, a soft grain overlay, the
  album's initial in 800-weight white at 40% opacity. Generated art is ours, so
  it may also carry the grain.
- 1:1, 4px radius on phone, 8px on large screens, subtle outer shadow.
- Now Playing backdrop = an ambient field from the current cover's palette: two or
  three soft color pools drifting on independent 60–120s loops, brightened toward
  the cover's lightest tone at the top and darkened toward `bg` at the bottom, over
  the static dominant-color gradient (`#191414` fallback). Motion is seeded by
  track, pauses with playback, when backgrounded, and under reduce-motion. The
  generated hue is the no-art fallback. The cover itself is never blurred,
  distorted, filtered or animated.
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
List rows use a light press-scale. The ambient backdrop moves on 60–120s loops and
is the only continuous background motion. No gratuitous bounces.

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
- `artist_art` (`artistKey`, `artworkUri`, `updatedAt`) for cropped artist art;
  `artistKey` is the normalized artist name, so a rescan keeps the cover
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
- Sheets: every bottom sheet lifts above the keyboard so the focused field and its
  submit row stay visible. Every full-screen form keeps its field and submit action
  visible too. No text field may sit under the keyboard.
- Selection: every multi-select has Select all / Unselect all scoped to the rows
  currently visible, with a mixed state when only some are selected.
- Artist art: stored in `artist_art` keyed by the normalized artist name; the first
  track's art is the fallback, and a custom cover survives a rescan. Artist meta
  reads "N songs" — no album counts on artist surfaces.
- Player controls: two primary actions (liked, lyrics) plus one expandable
  secondary row. Sleep timer is secondary, with a caption when active.
- Back: artist detail returns to Collections, Collections to Library; a selection
  clears before the page changes.
- Ambient backdrop: one animated palette field per track, seeded by track id and
  animated whenever the player is visible. Cover art itself never moves.
- Version: 0.8.2 (`versionCode` 802). `v8` shipped as 0.8.0, `v8.1` was the
  first feedback pass and `v8.2` is the second. `.github/workflows/release.yml`
  bumps and publishes on every push to `main`.

## Remaining after v2

1. **Notification next/previous.** Done in v3: playback moved to `AudioPlaylist`
   with a resolved window, `skipTo`, `trackChanged` and
   `showNextTrack/showPreviousTrack: true`. v8 covers the remaining gap — the
   notification seek bar and timestamps.
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
