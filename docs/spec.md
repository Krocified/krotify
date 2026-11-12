# krotify — Spec

Source of truth for what gets built. Intent lives in `docs/intent.md`.

## Platform & stack
| Concern | Choice | Why |
|--------|--------|-----|
| Platform | Android (APK) | User's device; local file access is native territory |
| Framework | React Native via Expo (dev build) | Fast UI iteration; ships an APK |
| Language | TypeScript | Default for Expo templates |
| Scan | `expo-media-library` | Reads every device audio file + permissions |
| Import | `expo-file-system` (`File.pickFileAsync`) | System file picker; no extra dependency |
| File ops | `expo-file-system` | Delete, copy imported files |
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

Blocked:
- Explicit badge: the metadata library exposes no explicit flag.

**Acceptance**
- Albums/Artists reflect tags rather than filenames.
- Search matches title, artist and album.
- Recently played contains only tracks actually played.
- Playlists and favorites persistence are ready for their UI.

### v3 — Delight and ownership

Prerequisite: the v2 leftovers (playlist UI, favorites UI, scan opt-in) and the
`AudioPlaylist` migration that makes notification next/previous work.

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
  offline. Timed highlight and auto-scroll; no licensed lyric sources.
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
  planned link-import section for YouTube-to-MP3 through a resolver service.
  The resolver is a server-side dependency; the app never scrapes YouTube, and
  the flow is limited to content the user has the rights to download.
- Batch edit is a stretch, not baseline.

Release packaging:
- The current universal APK is about 76MB because it carries arm64-v8a,
  armeabi-v7a, x86 and x86_64 native libraries. Ship an arm64-only build
  (roughly 24-28MB) for phones, or per-ABI APKs; keep one universal build only
  for emulator/testing use.
- CI builds the release architecture explicitly and the release notes name the
  ABI. Measure size before and after and record the result.

Stretch:
- Android Auto / media browser.

### v4 — Discovery (exploration)

Not committed features yet; v4 is a research milestone with legal and API spikes,
and every adopted item still needs a decision memo before code.

Sources to evaluate:
- https://docs.genius.com
- https://publicapis.dev/resource/radio-browser/mdybs5l2
- https://publicapis.dev/resource/audiometa-io/wlceksvl

- **Genius** (`https://docs.genius.com`): song/artist metadata and annotations.
  Its public API does not serve lyrics for playback; do not scrape the web
  pages. Use only for metadata enrichment if licensing allows; LRCLIB stays the
  lyrics source.
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
responses are cached, and source attribution is visible. No licensed lyric
catalogues and no scraping.

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

- **LRCLIB** (`https://lrclib.net`): optional lyrics lookup. Requests carry
  `User-Agent: Krotify <version> (https://github.com/Krocified/krotify)` (or
  `X-User-Agent` on web), are sequential with a short delay, and cache the
  response locally. Only title, artist, album and duration leave the device.
  Publishing, flagging and bulk prefetch are out of scope.
- **Genius**, **Radio Browser**, **Audiometa.io**: v4 exploration only, each
  behind an opt-in surface with its own terms, rate limits and attribution.
- **Link importer resolver** (planned, not selected): a self-hosted or
  third-party service that accepts a URL and returns audio plus metadata. It
  must not be scraped from the client. Requires a legal check: only content the
  user has the rights to download, and the service's terms must allow it.

## Screens & flows

**Tabs** — Library, Catalog, Import. Persistent on Settings, hidden on Now
Playing and Search. A floating blur pill above the system inset; active tab uses a
filled icon and white label, inactive uses an outline icon and dim label.
Settings stays in the header.

**Catalog** — Albums and Artists are one tab with a segmented control. Albums is
sectioned by artist; Artists is a list. Both keep their detail pages, heroes and
Search/Settings actions. The phone UI re-enables catalog here in v3.

**Library** — shared header (`Krotify` wordmark + lyrics mark, search, settings),
optional Recently played rail, track list. Rows show cover, title, artist,
duration; long press opens the in-app action sheet (details, edit, rename,
exclude, delete). Scrolling shows a thin blue scrollbar
from below the header to the mini-player.

**Catalog / Albums** — segmented control; artist section headers; rows with
cover, album title, and "N tracks · M min". Album detail has a back pill, hero
(160px cover, title, artist, count), then the track list.

**Catalog / Artists** — circular covers, artist name, "N albums · M tracks".
Artist detail mirrors the album detail with a circular hero.

**Import** — a dedicated tab, not a Settings row. Local file picker with a
recent-imports list, progress, empty and error states. A second section is
reserved for link import: paste a URL, resolve it through a server-side
converter, fetch metadata and artwork, then save into the app library. Direct
scraping of YouTube inside the app is out of scope; only content the user has
the rights to download is supported.

**Search** — slide-in overlay with a borderless field (accent cursor) and
incremental results across title, artist and album.

**Now Playing** — plain back/down control aligned with the other back pills, no
black pill. Full-bleed cover-color backdrop and draggable progress with previous/
play/next centered on play and repeat at the right. Two content modes share the
screen: **art** (large 1:1 cover, title, artist) and **lyrics** (a smaller cover
stays visible at the top while the timed lyrics fill the remaining space, active
line highlighted, lyric lines tappable to seek). The mode toggle sits in the top
bar or beside the transport. Closing is instant and returns to the screen it was
opened from.

**Mini-player** — floating card inset from the edges, radius 4, 2px inset
progress line, cover, title, artist, close and play/pause. It stacks above the
tabs and is never dimmed by their fade. Horizontal swipe slides only the content
and moves to the next or previous track with queue wrap; vertical swipe does
nothing; the bar itself never moves. Closing the song page returns to this card
at the current position with no slide.

**Settings** — slide-in page, sectioned into Library (rescan, import, exclude
all), Hidden tracks (restore), About (version from `app.json`). Tabs and the
mini-player stay available.

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
- Now Playing backdrop = color extracted from the current cover, dimmed to ~35%
  (`#191414` fallback), filling the screen behind the content. No blur of real art.
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
- `playlists`, `playlist_tracks` (gap-numbered positions)
- `favorites`
- `play_history`
- `track_metadata` (cached ID3 fields and artwork URI)

Imports and exclusions remain in AsyncStorage from v1.

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
- Navigation: state-based tabs in `AppShell` (Library, Albums, Artists), not
  expo-router. Settings and Search are overlays with slide transitions.
- Search: incremental, accent-folded, across title/artist/album.
- History: play history deduped by track, most recent first.
- Tagless tracks: keep the filename-derived title; never hide a playable file.
- Excluded tracks: surfaced in Settings under Hidden tracks with Restore.
- Scrollbar: custom accent-blue thumb, active only while scrolling, draggable,
  ends level with the bottom player.
- Grain: still deferred; covers are gradient plus initial when no real art.
- Version: 0.2.0 (`versionCode` 2). Release `v0.1.0` exists; CI release automation
  is planned in `docs/superpowers/plans/2026-11-12-gh-actions-release.md`.

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
5. **Explicit badge.** Blocked: the metadata library exposes no explicit flag.
   Needs another parser or a deliberate drop.
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
