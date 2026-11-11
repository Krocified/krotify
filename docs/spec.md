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
| Persistence | `expo-sqlite` (v2), AsyncStorage before that | Playlists, favorites, history, exclusions |
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
  dedupe by URI. Sort A→Z by title.
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
- Queue: tap-to-play sets queue; next/prev work, including from lock screen.
- Now Playing: draggable progress, repeat.
- Previous follows the standard two-tier rule: past 3 seconds it restarts the
  current track; at or before 3 seconds it skips to the previous queue entry,
  and does nothing at the first track.
- Reopening the track that is already loaded resumes from its position; it never
  restarts. Hardware back from Now Playing plays the same slide-down as the
  chevron.
- At the end of a track, playback advances to the next queue entry; at the last
  track it stops at the end, and Play restarts that track from 0:00.
- Next/previous take effect instantly: the progress bar jumps to the new
  position instead of animating back across the old one.
- Notification artwork for tracks that have real art (generated covers have no
  file yet — acceptable to omit `artworkUrl`).

**Acceptance**
- Next/prev traverse the queue in order.
- Notification controls drive the same player state as the in-app controls.

### v2 — Real library
- Group by Album and Artist using ID3 tags; show embedded art when present.
- Search across title/artist/album.
- Playlists: create, add, reorder, delete (SQLite).
- Import: pick audio files with the system file picker; imported files are
  copied into app storage so they survive restarts and provider changes.
- Library management per track: **exclude** (hide, keep the file, reversible) or
  **delete** (remove from device storage, confirmed first, irreversible).
- Favorites/heart via a `+` toggle with "Added to Liked Songs" / "Removed from
  Liked Songs" confirmation.
- Play-history store; Library gains the "Recently played" rail from real plays.
- Explicit badge next to track titles when the tag is present.

**Acceptance**
- Albums/Artists screens reflect real tags, not filenames.
- A playlist survives app restart.
- Search returns matches across all three fields.
- An imported file plays after a restart and appears once, not twice.
- An excluded track disappears from the library and comes back when re-included;
  its file still exists. A deleted track is gone from storage after confirmation.

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

**Library (home)** — top bar (`krotify` wordmark), then a track list. A horizontal
"Recently played" rail slots in above the list once real play history exists (v2);
v0 does not seed or fake it. Tapping a row opens Now Playing.
**Now Playing** — full-bleed backdrop extracted from the current cover's color, a
large 1:1 cover, title/artist, progress, transport controls. Slides up from the
mini-player.
**Mini-player** — persistent bottom bar on Library and Settings: 2px progress line,
small cover, title, close, play/pause. Tap or swipe up expands; swipe down, left
or right dismisses the player (stops playback). Reopening the playing track
resumes its position.
**Settings** — gear from the Library top bar. Slides in from the right and back
out to the right. Rescan, permission status, hidden tracks, about. Grows one
option at a time.

```
┌──────────────────────────┐   ┌──────────────────────────┐
│ krotify            ⚙      │   │ ⌄                   ⋯     │
│ Recently played          │   │        ▟▛▟▛▟▛▟▛▟▛         │
│ ▢  ▢  ▢  ▢               │   │        ▙▟▙▟▙▟▙▟▙▟         │  cover
│                          │   │        ▟▛▟▛▟▛▟▛▟▛         │  color
│ ▢ Track — Artist   3:24  │   │        ▙▟▙▟▙▟▙▟▙▟  cover  │  backdrop
│ ▢ Track — Artist   4:01  │   │                          │
│ ▢ Track — Artist   2:59  │   │ Track title              │
│ ▢ Track — Artist   5:12  │   │ Artist · Album           │
│                          │   │ ────●──────────────  1:12 │
│ ──────────────────────── │   │ ⤨   ⏮   ⏯   ⏭   ↻        │
│ ▢ Track    ⏯             │   └──────────────────────────┘
└──────────────────────────┘
```

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
| `accent` | `#7C5CFF` | Electric violet: active state, progress |
| `accent2` | `#FF6B57` | Coral: gradients, secondary highlights |

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

**Motion** — 250–350ms ease-out for Now Playing expand/collapse; progress bar
animates imperatively; list rows use a light press-scale. No gratuitous bounces.

## Data model
```ts
type Track = {
  id: string;
  uri: string;        // file:// on device; empty for demo tracks
  source: 'scan' | 'import' | 'demo';
  title: string;
  artist: string;     // '' in v0; real tags from v2
  album: string;      // '' in v0; real tags from v2
  durationMs: number;
  artworkHue: number; // seed for generated cover when no real art
  artworkUri?: string;
};
type PlayerState = {
  queue: Track[];
  index: number;
  isPlaying: boolean;
  positionMs: number;
};
// v2 SQLite: excluded(uri) is the only new table needed for library hiding;
// playlists, favorites and history are their own tables.
```

## Demo data
A small in-memory library (6–8 tracks with distinct hues) shipped in v0 so the UI
can be judged and the app runs anywhere. Real device audio replaces it when the
scan succeeds. Demo tracks are the only fallback — no fake play history.

## Decisions
- Fonts: platform default sans (Helvetica Neue → Helvetica → Arial as fallback),
  per Spotify's font guidance. System fonts through v2; wordmark can get its own
  face later.
- Accent: violet `#7C5CFF` confirmed. Spotify Green is off-limits — brand
  separateness rules forbid resembling their mark or color.
- Recently played: not seeded. The rail ships with the real history store in v2;
  v0 has no rail.
- Scan: all audio files, no duration filter. Rescan from Settings.
- Settings: ships in v0 as a real screen; options are added only when the feature
  behind them exists.
- Shuffle: deferred. Revisit after v2, before v3.
- Metadata: v0 uses filename-derived titles, no artist column. ID3 tags and
  embedded art stay in v2.
- Grain: the generated-cover grain overlay is deferred past v0; gradient plus
  initial is the v0 cover.

## Open decisions

**When v2 lands**
- Navigation: `expo-router` files (AGENTS.md rule) vs adding a navigator lib
  for Albums/Artists/Search.
- Playlist reorder: drag handle or long-press-drag.
- Search: incremental filtering vs submit; diacritic/case folding.
- Play history: retention window, dedupe, ordering.
- Tagless tracks: fall back to filename/folder naming, or hide them?
- Artwork color extraction for the Now Playing backdrop: which
  already-installed tool if any, before adding a dependency.
- Resume position across app restarts.
- Where excluded tracks are surfaced: a "Hidden" list in Settings, or only
  re-includable from search.

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
