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
| Visuals | `expo-linear-gradient`, `react-native-safe-area-context`, RN `Animated` | Gradients, insets, motion without heavyweight libs |

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

### v3 — Delight
- Shuffle (deferred from v1): define queue-order vs random-next, and how it
  interacts with repeat.
- Sleep timer, gapless/crossfade, lyrics (local `.lrc`).
- Settings screen grows as features land; each new toggle/option is added when
  it actually exists, no placeholder rows.
- Android Auto / media browser (stretch).

### v4 — Own your library
- Edit a track's details: title, artist, album, track/disc number, year, genre,
  artwork. Writes back into the file's tags, not just the app DB.
- Saving rewrites the file atomically (temp + replace), then re-reads tags for
  that track. A failed write leaves the original intact and says so.
- Imported copies are always editable (app owns them). Scanned files are only
  editable when writable; if not, offer "import a copy and edit that".
- Batch edit for a selection is optional, not v4 baseline.

## Library management

Two sources, one list.
- **Scan** — every audio file the device exposes (all audio types, no duration
  floor). Files are referenced in place. `expo-media-library` permission; denial
  falls back to the demo library.
- **Import** — system file picker (`File.pickFileAsync`, `audio/*`, multi-select).
  Copies into app storage. Files already in the library are skipped by URI, never
  duplicated.

**Exclude vs delete**
- Exclude is app state only: store the URI/id in a `excluded` table, filter it out
  of every list and queue. Undo is one tap, file untouched.
- Delete is destructive: confirm in a dialog that names the track, then call
  `Asset.delete(assets)` for scanned media (Android shows its own system
  confirmation) or `File.delete()` for imported copies. (`deleteAssetsAsync` is
  deprecated and throws in SDK 58.) Also delete the track's rows (favorites,
  playlists, history, exclusions). Never delete a file
  the app did not import unless the user explicitly hit delete.

## Settings

A real screen from v0, minimal: library rescan, permission status, about. Every
other option appears only once the feature behind it exists.

## Screens & flows

**Tabs** — Library, Albums, Artists. Persistent on Settings, hidden on Now
Playing and Search. Fine at the bottom above the system inset; active tab uses a
filled icon and white label, inactive uses an outline icon and dim label.

**Library** — shared header (`Krotify` wordmark + lyrics mark, search, settings),
optional Recently played rail, track list. Rows show cover, title, artist,
duration; long press opens exclude/delete. Scrolling shows a thin blue scrollbar
from below the header to the mini-player.

**Albums** — header with albums icon and title; artist section headers; rows with
cover, album title, and "N tracks · M min". Album detail has a back pill, hero
(160px cover, title, artist, count), then the track list.

**Artists** — header with artists icon and title; circular covers, artist name,
"N albums · M tracks". Artist detail mirrors the album detail with a circular
hero.

**Search** — slide-in overlay with a borderless field (accent cursor) and
incremental results across title, artist and album.

**Now Playing** — plain back/down control aligned with the other back pills, no
black pill. Full-bleed cover-color backdrop, large cover, title/artist, draggable
progress (larger bar and thumb while dragging), previous/play/next centered on
play, repeat at the right. Closes instantly to the screen it was opened from.

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

**Tab bar** — no border, transparent to `#0B0B0F` gradient starting a quarter of
the row height above the tabs and ending at 75% opacity, filled icon + white text
for the active tab, outline icon + dim text otherwise.

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

**v4**
- Tag writer: which library can write ID3/MP4 tags on Android? None is in the
  stack yet. Decide between a maintained native writer or writing only through
  app-owned copies.
- Write access to scanned files: SAF re-grant per folder, or restrict editing to
  imported files and offer "import a copy".

- Web preview: `npx expo start --web` (or `npx expo export --platform web`) serves a
  demo-only surface — demo library plus mock playback — so people on iOS or a
  laptop can try the UI. Scanning, background audio and notification controls
  remain Android-only.
