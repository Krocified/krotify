# v3 Delight and Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Krotify a player that shapes the listening session (shuffle, sleep timer, gapless, lyrics, playlists, favorites) and lets the owner edit the files themselves (tags and artwork), while keeping the app local-first and the Android release lean.

**Architecture:** One `AudioPlaylist` engine replaces the single `AudioPlayer` path, so lock-screen next/previous and gapless are native. Player state stays in `PlayerProvider`; a rolling playlist window maps native indices to the app queue. Shuffle, sleep, lyrics and tag validation are pure modules in `src/lib/`. Tag writing is a local Expo module backed by jaudiotagger, wrapped by a TypeScript service that writes atomically and re-reads the cache.

**Tech Stack:** Expo SDK 58, React Native 0.88, TypeScript strict, `expo-audio` (`AudioPlaylist`), `expo-sqlite`, `expo-file-system`, `expo-blur`, `@missingcore/react-native-metadata-retriever`, Ionicons, a local Kotlin Expo module with jaudiotagger.

**Spec:** `docs/spec.md` (v3 section; intent in `docs/intent.md`).

## Global Constraints

- Android only. A development build is required; Expo Go cannot prove audio or notification work.
- Local files are the source of truth. Playback must work with no network and no account.
- Lyrics lookup is the only v3 network call. It is opt-in, cached, and never blocks playback.
- Crossfade is dropped. Gapless comes from `AudioPlaylist`; do not add a second playback engine.
- Link import goes through a resolver service, never direct scraping. Only content the user has the rights to download; record the legal check.
- Any tag write is explicit, confirmed, atomic (temp file then replace) and followed by a re-read. A failed write leaves the original playable and unchanged.
- Scanned files are written only after `MediaStore.createWriteRequest` grants access; otherwise offer "Import a copy and edit".
- No new runtime dependency without confirming the SDK-compatible version with `npx expo install`.
- Icons are Ionicon names. No comments unless they explain a non-obvious decision.
- Every non-trivial pure helper gets a `node --test` test. Run `npm test`, `npx tsc --noEmit`, `npx expo lint`, and `npx expo export --platform web` before a task is done.
- Conventional Commits. Never push without an explicit instruction in the current request.

## Review Focus

1. **Playlist window edges:** notification next/prev, shuffle, repeat and queue edits can never strand playback, replay the wrong index, or map a native index to the wrong track.
2. **Write failure:** a cancelled write request, disk-full, unsupported container or provider error leaves the file playable and unchanged, and the UI says so.
3. **Sleep timer:** cancelling, changing tracks, or stopping never leaves a fade running, volume at zero, or a late stop.
4. **Lyrics input:** missing sidecars, bad encoding, malformed timestamps, HTTP 429/5xx and offline mode never crash Now Playing or scroll to nowhere.
5. **Sheets and destructive actions:** every sheet closes on back/escape, traps focus, and a delete is never triggered without an in-app confirmation.

---

## Baseline: 0.2.2 hotfix (already in the working tree)

The following fixes are written and passing tests but not released. Commit them
before Task 1, as one `fix:` commit so the release workflow publishes a patch.

- Scan filters ringtones/notifications/alarms/UI by MediaStore album title, URI and filename; files under 3s stay filtered.
- Imports keep the original basename in `imports/<stamp>-<index>/<name>`; picker names are decoded and sanitized; imported tracks enrich immediately.
- The library keeps a master track list; exclusions filter the visible list only; Hidden tracks restore returns with per-track and Restore all actions.
- Exclude all works after rescan and import because it targets unexcluded scanned tracks in the master list.

Files: `src/library/scan.ts`, `src/library/imports.ts`, `src/library/exclusions.ts`, `src/lib/scanFilter.ts`, `src/lib/importName.ts`, `src/AppShell.tsx`, `src/screens/SettingsScreen.tsx`, tests under `tests/`.

- [ ] Run `npm test`, `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform web`.
- [ ] Commit `fix: repair scan import and exclusions`.
- [ ] Do not push until the user asks.

---

## File Map

| File | Responsibility |
|---|---|
| `src/player/audioEngine.ts` | `AudioPlaylist` instance, rolling window, lock-screen options, volume |
| `src/player/PlayerProvider.tsx` | App queue/index, shuffle, sleep, resume, sync with playlist events |
| `src/lib/playlistWindow.ts` | Pure window math and append-ahead decisions |
| `src/lib/shuffle.ts` | Pure shuffle order and restore |
| `src/lib/sleepTimer.ts` | Pure countdown/fade math |
| `src/lib/lrc.ts` | `.lrc` parser |
| `src/library/lyrics.ts` | Sidecar discovery and cache |
| `src/library/lrclib.ts` | LRCLIB client |
| `src/lib/tagPatch.ts` | Validation and normalization of edit fields |
| `src/library/tagWriter.ts` | TypeScript wrapper over the native tag module |
| `modules/audio-tags/` | Local Expo module: jaudiotagger read/write, atomic replace, write requests |
| `src/screens/EditTrackScreen.tsx` | Metadata edit form and save flow |
| `src/components/TrackActionsSheet.tsx` | In-app long-press action sheet |
| `src/components/ConfirmSheet.tsx` | In-app destructive confirmation |
| `src/components/Sheet.tsx` | Shared bottom-sheet shell, focus and back handling |
| `src/screens/PlaylistsScreen.tsx` | Playlist index and detail |
| `src/screens/LikedScreen.tsx` | Favorites list |
| `src/library/FavoritesProvider.tsx` | Favorite ids and toggle shared by every surface |
| `src/screens/CatalogScreen.tsx` | Albums/Artists segmented catalog |
| `src/screens/ImportScreen.tsx` | Local import plus link-import entry |
| `src/library/linkImport.ts` | Resolver client, progress, save-to-library |
| `src/screens/NowPlayingScreen.tsx` | Shuffle, art/lyrics mode, sleep indicator |
| `src/components/LyricsPanel.tsx` | Timed lyric list, active-line scroll, seek on tap |
| `src/screens/SettingsScreen.tsx` | Playback, scan, hiding, lyrics, editing, About |
| `src/lib/resume.ts` | Persist/restore the last track and position |
| `tests/playlistWindow.test.ts` | Window edges and append-ahead |
| `tests/shuffle.test.ts` | Order, restore, repeat interaction |
| `tests/sleepTimer.test.ts` | Countdown, fade window, cancel |
| `tests/lrc.test.ts` | Timestamps, offsets, malformed lines |
| `tests/tagPatch.test.ts` | Validation, empty patches, artwork rules |

---

### Task 1: AudioPlaylist engine and lock-screen controls

**Files:**
- Modify: `src/player/audioEngine.ts`
- Modify: `src/player/PlayerProvider.tsx`
- Create: `src/lib/playlistWindow.ts`
- Create: `tests/playlistWindow.test.ts`
- Create: `plugins/with-notification-icon.js`
- Modify: `app.json`

**Interfaces:**
- `playlistWindow(index: number, length: number, radius?: number): { start: number; end: number; localIndex: number }`
- `nextWindowSize(currentLocal: number, trackCount: number, queueLength: number, windowStart: number, radius?: number): number` returns how many upcoming queue tracks to append so at least 3 tracks remain ahead, capped at the queue end.
- `createEngine(): { playlist: AudioPlaylist; load(tracks: WindowTrack[], localIndex: number): void; append(tracks: WindowTrack[], globalIndexes: number[]): void; skipTo(local: number): void; setVolume(value: number): void; setLoop(mode: 'none' | 'single' | 'all'): void; stop(): void }`
- `WindowTrack = { uri: string; track: Track }`

- [ ] Write failing tests for `playlistWindow`: index 0, middle, last, length smaller than `2 * radius + 1`, empty queue.
- [ ] Write failing tests for `nextWindowSize`: appending near the end, no append at queue end, no append while more than 3 tracks remain.
- [ ] Implement both helpers.
- [ ] Replace the module-level `AudioPlayer` with `createAudioPlaylist({ updateInterval: 500 })`. Keep `configureAudio()` unchanged.
- [ ] Load the window with `playlist.clear()`, `playlist.add({ uri })` for each entry, `playlist.skipTo(localIndex)`, then `play()`.
- [ ] Append ahead on `trackChanged` when `nextWindowSize` returns a positive count; keep a `globalIndexes: number[]` map so native index always resolves to the queue index.
- [ ] On app next/previous, compute the target queue index first. If it is inside the loaded window, call `skipTo`; otherwise reload a window centered on the target.
- [ ] Set `playlist.setActiveForLockScreen(true, metadata, { showNextTrack: true, showPreviousTrack: true, showSeekBackward: true, showSeekForward: true })` and call `updateLockScreenMetadata` on every track change, including `artworkUrl` when the track has real art.
- [ ] Map repeat: `off -> none`, `single -> single`, `all -> all`. Rebuild the window on queue changes so native indices stay valid.
- [ ] Add `plugins/with-notification-icon.js` that writes a monochrome `res/drawable/media3_icon_circular_play.xml` (a simple waveform or note glyph) so the notification uses a real small icon instead of a blank placeholder. Register it before `with-media3-exclude.js` in `app.json`.
- [ ] Spike a moving visualizer in the MediaStyle notification. Android does not support live animated RemoteViews there; if it cannot be done reliably, keep the static glyph and record the decision.
- [ ] Device checks: lock screen next/prev changes track, play/pause icon matches state, artwork appears, adjacent tracks are gapless, notification small icon is visible.
- [ ] Commit `feat: move playback to playlist engine`.

---

### Task 2: Shuffle

**Files:**
- Create: `src/lib/shuffle.ts`
- Create: `tests/shuffle.test.ts`
- Modify: `src/player/PlayerProvider.tsx`
- Modify: `src/screens/NowPlayingScreen.tsx`

**Interfaces:**
- `shuffleOrder(queue: Track[], keepIndex: number, random: () => number): { order: Track[]; index: number }`
- `restoreOrder(original: Track[], currentId: string): { order: Track[]; index: number }`
- Context: `shuffle: boolean`, `toggleShuffle(): void`.
- Player keeps `originalQueue` while shuffled.

- [ ] Tests: no dropped or duplicated tracks; the current track stays first; deterministic with a seeded RNG; restore finds the current track in the original order.
- [ ] Implement the pure helpers.
- [ ] On enable: shuffle the remainder after the current track, keep the current track at the front, rebuild the playlist window.
- [ ] On disable: restore the original queue at the current track, rebuild the window.
- [ ] Repeat one replays the current track. Next/previous follow the shuffled order.
- [ ] Add a shuffle button next to repeat (`Ionicons shuffle`) with `accessibilityState={{ selected: shuffle }}`, accent when on.
- [ ] Commit `feat: add shuffled playback`.

---

### Task 3: Sleep timer

**Files:**
- Create: `src/lib/sleepTimer.ts`
- Create: `tests/sleepTimer.test.ts`
- Modify: `src/player/PlayerProvider.tsx`
- Modify: `src/screens/SettingsScreen.tsx`
- Modify: `src/screens/NowPlayingScreen.tsx`

**Interfaces:**
- `SLEEP_PRESETS = [15, 30, 45, 60, 'end'] as const`
- `tickSleep(remainingMs: number, elapsedMs: number): { remainingMs: number; fadeFrom: number | null; done: boolean }`
- Context: `sleep: { mode: 'off' | 'timer' | 'end'; remainingMs: number }`, `setSleep(mode, minutes?)`.

- [ ] Tests: countdown math, last-10s fade window, completion, cancel, zero remaining.
- [ ] Implement the timer state. Fade volume from 1 to 0 over the last 10 seconds by setting `playlist.volume`; restore volume on cancel, stop or track change.
- [ ] End-of-track mode stops after the current track finishes (`handleEnd` hook).
- [ ] Settings Playback section: preset chips, Cancel, and remaining time while armed.
- [ ] Now Playing shows a small sleep indicator and remaining minutes; tapping it opens the same presets.
- [ ] Device: fade is audible, stop happens, cancel never leaves volume at 0.
- [ ] Commit `feat: add sleep timer`.

---

### Task 4: Lyrics (.lrc and LRCLIB) and Now Playing art/lyrics layout

**Files:**
- Create: `src/lib/lrc.ts`
- Create: `src/library/lyrics.ts`
- Create: `src/library/lrclib.ts`
- Create: `src/components/LyricsPanel.tsx`
- Create: `tests/lrc.test.ts`
- Modify: `src/screens/NowPlayingScreen.tsx`
- Modify: `src/screens/SettingsScreen.tsx`

**Interfaces:**
- `parseLrc(text: string): { lines: { atMs: number; text: string }[]; offsetMs: number }`
- `findLyricsFile(track: Track): Promise<string | null>` tries same-basename `.lrc`, then `Lyrics/<basename>.lrc` beside the audio file.
- `fetchLrclibLyrics(input: { title: string; artist: string; album: string; durationMs: number }): Promise<{ kind: 'synced' | 'plain' | 'instrumental' | 'none'; text?: string }>`
- `useLyrics(track): { state: 'idle' | 'loading' | 'ready' | 'none' | 'error'; lines; plain?: string }`

LRCLIB rules: base `https://lrclib.net`; `GET /api/get?track_name=&artist_name=&album_name=&duration=`; `User-Agent: Krotify <version> (https://github.com/Krocified/krotify)` or `X-User-Agent` on web; sequential requests with 200-500ms spacing; cache successes and 404s locally keyed by track id; honor `429 Retry-After`; never send anything except title, artist, album and duration.

- [ ] Tests: timestamps, multiple timestamps per line, `[offset:]`, CRLF, malformed lines skipped, empty text.
- [ ] Implement the parser and sidecar discovery.
- [ ] Implement the LRCLIB client with duration matching (±2s), local cache, and typed errors.
- [ ] Now Playing gets two modes. Art mode keeps the current layout. Lyrics mode keeps a 160-200px cover and title/artist at the top and gives the rest to `LyricsPanel`.
- [ ] Backdrop uses the extracted cover color when `artworkUri` exists. If no palette dependency is approved, keep the hash backdrop and record the decision in the spec.
- [ ] Backdrop, top controls, progress and transport stay fixed; only the cover, title block and lyric area reflow with a 200ms crossfade.
- [ ] Lyrics toggle (`document-text-outline`, accent when active) in the top bar with a label and selected state.
- [ ] `LyricsPanel`: active line full color, surrounding lines dim, auto-scroll to about one third, tap a line to seek. No per-line live announcements.
- [ ] Failed lookup: stay in art mode and show "Lyrics not found" only after the user asks. Never an empty full screen.
- [ ] Settings Lyrics section appears only when the feature ships: enable/disable network lookup and show the cached count.
- [ ] Device: real `.lrc`, fetched LRCLIB result, offline with no cache.
- [ ] Commit `feat: add local and LRCLIB lyrics`.

---

### Task 5: Tag writer spike and native module

**Files:**
- Create: `modules/audio-tags/expo-module.config.json`
- Create: `modules/audio-tags/android/build.gradle`
- Create: `modules/audio-tags/android/src/main/java/.../AudioTagsModule.kt`
- Create: `modules/audio-tags/index.ts`
- Create: `src/lib/tagPatch.ts`
- Create: `src/library/tagWriter.ts`
- Create: `tests/tagPatch.test.ts`
- Modify: `src/types.ts` (add `discNumber?: number`, `explicit?: boolean`)
- Modify: `src/db/repo.ts`, `src/db/schema.ts` (DB version 2: `discNumber`, `explicit`)
- Modify: `app.json`

**Interfaces:**
- `TagFields = { title?: string; artist?: string; album?: string; albumArtist?: string; trackNumber?: number; discNumber?: number; year?: number; genre?: string; explicit?: boolean }`
- Native: `readTags(uri: string): Promise<TagFields>`
- Native: `writeTags(uri: string, fields: TagFields, artworkUri?: string): Promise<TagFields>`
- Native: `requestWriteAccess(uris: string[]): Promise<string[]>`
- TS: `applyTagEdit(track: Track, patch: TagFields): Promise<Track>` handles validation, write, cache update and typed errors.
- `validateTagPatch(patch: Partial<TagFields>): { ok: true; value: TagFields } | { ok: false; errors: string[] }`

- [ ] Spike first: build a minimal jaudiotagger write on a copied MP3, verify with `@missingcore/react-native-metadata-retriever`, then decide keep or replace. Record the result in this plan.
- [ ] Tests: empty edit is rejected, year/track/disc are integers when present, artwork mime must be image/*, oversized artwork is rejected.
- [ ] Native write path: write to a temp file in the same directory as the original, close it, rename over the original, reopen and read back.
- [ ] Support MP3, FLAC, OGG and M4A through jaudiotagger. Unsupported containers throw `UNSUPPORTED_FORMAT` before any write.
- [ ] Read the advisory/rating tag when jaudiotagger exposes it and map it to the explicit badge. If no reliable flag exists, record "explicit badge dropped" in the spec and remove the blocked item.
- [ ] `applyTagEdit` updates `track_metadata` and returns the refreshed track. A failure leaves the cache and file unchanged.
- [ ] Register the module with `app.json`/autolinking; confirm `npx expo prebuild --platform android --clean` still builds.
- [ ] Device: edit an imported copy, confirm another app sees the new tags after reinstall.
- [ ] Commit `feat: add native tag writer`.

---

### Task 6: Write access, edit UI, action sheets and details

**Files:**
- Modify: `modules/audio-tags/` (write request)
- Create: `src/components/Sheet.tsx`
- Create: `src/components/TrackActionsSheet.tsx`
- Create: `src/components/ConfirmSheet.tsx`
- Create: `src/screens/EditTrackScreen.tsx`
- Modify: `src/AppShell.tsx`
- Modify: `src/screens/LibraryScreen.tsx`
- Modify: `src/library/imports.ts` (import-a-copy path)
- Defer: catalog detail entry until Task 10 creates `CatalogScreen`

**Interfaces:**
- `Sheet({ visible, title?, onClose, children })`: bottom sheet on `surface`, 20px top radius, grabber, dimmed backdrop, 200ms slide-up, tap backdrop / Android back / Escape to close, focus trapped.
- `TrackActionsSheet({ track, onClose, onDetails, onEdit, onRename, onExclude, onDelete, onFavorite, onAddToPlaylist })`
- `ConfirmSheet({ visible, title, message, confirmLabel, destructive, onConfirm, onCancel })`
- `EditTrackScreen` props: `{ track, onSaved(track), onClose }`.

- [ ] Request write access for scanned tracks before the edit flow; if denied, offer "Import a copy and edit" through the existing import path.
- [ ] Form fields: title, artist, album, album artist, track number, disc number, year, genre, artwork picker (image mime), Save/Cancel, busy and error states.
- [ ] On save: validate, write, re-read, update the library and cache, close with the refreshed track.
- [ ] Replace every management `Alert.alert` in `AppShell` with `TrackActionsSheet`. Long-press opens Details, Edit metadata, Rename, Exclude, Delete, Favorite, Add to playlist, Cancel.
- [ ] Delete opens `ConfirmSheet` naming the track. Settings bulk actions use `ConfirmSheet` too. No native dialogs on Android or web.
- [ ] Details shows read-only title, artist, album, album artist, track/year, genre, duration, format, file size and path when available.
- [ ] Rename edits the title only, then flows through the same validator/writer.
- [ ] Entry points: long-press in Library now; add the same handler to catalog detail after Task 10.
- [ ] Device: sheet open/close, rename, delete confirmation, denied permission, failed write, successful write, artwork change.
- [ ] Commit `feat: edit track metadata and artwork`.

---

### Task 7: Playlists UI

**Files:**
- Create: `src/screens/PlaylistsScreen.tsx`
- Modify: `src/AppShell.tsx`
- Modify: `src/components/TrackActionsSheet.tsx`
- Modify: `src/screens/LibraryScreen.tsx`
- Modify: `src/db/repo.ts` only if a query is missing

**Interfaces:**
- `PlaylistsScreen({ onClose, onPlay(queue: Track[]) })`
- App actions: `openPlaylist(id)`, `playPlaylist(queue)`.
- Uses existing `listPlaylists`, `createPlaylist`, `renamePlaylist`, `deletePlaylist`, `listPlaylistTracks`, `addPlaylistTrack`, `removePlaylistTrack`, `movePlaylistTrack`.

- [ ] Index: create, rename, delete, empty state. Entry from the Library playlists rail.
- [ ] Use an AppShell overlay state for the playlist screens; do not extend `ScreenName` before Task 10 reworks navigation.
- [ ] Detail: track rows, remove, up/down reorder, play playlist as its own queue.
- [ ] Action sheet "Add to playlist" opens a picker; duplicates are skipped and the user is told.
- [ ] Persist through SQLite only; no AsyncStorage fallback for playlists on native.
- [ ] Device: create, reorder, play, delete, restart persistence.
- [ ] Commit `feat: add playlist ui`.

---

### Task 8: Favorites and Liked Songs

**Files:**
- Create: `src/library/FavoritesProvider.tsx`
- Create: `src/screens/LikedScreen.tsx`
- Modify: `src/AppShell.tsx`
- Modify: `src/AppShell.tsx` provider wrapping (`src/App.tsx` if needed)
- Modify: `src/screens/NowPlayingScreen.tsx`
- Modify: `src/components/TrackActionsSheet.tsx`

**Interfaces:**
- `useFavorites(): { ids: Set<string>; isFavorite(id): boolean; toggle(id): Promise<boolean> }`
- `LikedScreen({ onClose, onPlay(queue: Track[]) })`

- [ ] Load favorite ids from `listFavoriteIds()` once and keep them in context.
- [ ] Use an AppShell overlay state for Liked Songs; do not extend `ScreenName` before Task 10.
- [ ] Show a heart toggle in Now Playing and the action sheet with in-app feedback "Added to Liked Songs" / "Removed from Liked Songs".
- [ ] A Liked Songs row on Library opens the list; the list plays with its own queue.
- [ ] Device: toggle, restart persistence, removed track disappears from the list.
- [ ] Commit `feat: add favorites`.

---

### Task 9: Scan opt-in, hidden restore, resume position

**Files:**
- Create: `src/library/scanPrefs.ts`
- Create: `src/lib/resume.ts`
- Create: `tests/resume.test.ts`
- Modify: `src/AppShell.tsx`
- Modify: `src/screens/LibraryScreen.tsx`
- Modify: `src/screens/SettingsScreen.tsx`
- Modify: `src/player/PlayerProvider.tsx`

**Interfaces:**
- `loadScanPref(): Promise<boolean>`, `saveScanPref(enabled: boolean): Promise<void>`, key `krotify.scanEnabled.v1`.
- `serializeResume(state): string`, `parseResume(raw): { trackId: string; positionMs: number } | null`.
- Player: `restore(track: Track, resolveUri, positionMs: number): Promise<boolean>` loads a window, seeks, and does not play.

- [ ] First-run sheet "Scan this device for audio?" with Scan and Not now. Not now requests no permission and keeps imports visible.
- [ ] Settings switch: on requests permission and scans; off keeps imports and stops scanning.
- [ ] Keep the Hidden tracks section and Restore/Restore all from the 0.2.2 hotfix.
- [ ] Persist the last track id and position every 5 seconds while playing, on pause, on stop, and on app background. Restore after the library loads, without autoplay.
- [ ] If the saved track is gone, clear the saved state silently.
- [ ] Device: first run allow/deny, switch on/off, restore, kill and relaunch resumes at the saved position.
- [ ] Commit `feat: add scan opt-in and resume`.

---

### Task 10: Catalog consolidation and Import tab

**Files:**
- Create: `src/screens/CatalogScreen.tsx`
- Create: `src/screens/ImportScreen.tsx`
- Modify: `src/AppShell.tsx`
- Modify: `src/components/TabBar.tsx`
- Modify: `src/types.ts`
- Modify: `src/screens/SettingsScreen.tsx`
- Delete or retire: `src/screens/AlbumsScreen.tsx`, `src/screens/ArtistsScreen.tsx` after their content moves

**Interfaces:**
- `TabName = 'library' | 'catalog' | 'import'`
- `ScreenName` gains `'catalog' | 'import'`; remove `'albums' | 'artists'` once nothing references them.
- `CatalogScreen({ tracks, onSelect, onArtworkLoaded, onOpenSearch, onOpenSettings })` with a segmented Albums/Artists control and the existing list/detail behavior.

- [ ] Build `CatalogScreen` from the existing album and artist components; one tab replaces the two hidden entries and is enabled on phone.
- [ ] Build `ImportScreen`: local picker, recent imports, progress, empty and error states.
- [ ] Move the import control out of Settings; keep exclude all and hiding there.
- [ ] Import keeps the AsyncStorage index, dedupe and the 0.2.2 filename fix.
- [ ] Device: segments, detail navigation, import a local file, tab persistence, back behavior.
- [ ] Commit `feat: add catalog and import tabs`.

---

### Task 11: Link import spike (conditional ship)

**Files:**
- Create: `src/library/linkImport.ts`
- Modify: `src/screens/ImportScreen.tsx`
- Modify: `src/screens/SettingsScreen.tsx`

**Interfaces:**
- `resolveLink(url: string, signal: AbortSignal): Promise<{ audioUrl: string; title: string; artist?: string; artworkUrl?: string; durationMs?: number }>`
- Feature flag `LINK_IMPORT_ENABLED` and resolver base URL in Settings (never hard-coded secrets).

- [ ] Spike a resolver first: self-hosted yt-dlp service or a licensed converter API. Record terms, legal constraints and the request/response shape in this plan. No direct scraping in the client, ever.
- [ ] If no acceptable resolver exists, ship the section disabled with a clear note and stop here.
- [ ] Client: paste URL, call the resolver, save audio into app storage, add to imports, show progress and cancel.
- [ ] Failure states: unsupported link, blocked/private video, resolver offline, disk full.
- [ ] Rights gate: only content the user has the rights to download; explain this in the UI before the request.
- [ ] Device: a permitted link imports and plays; a blocked link shows the right error.
- [ ] Commit `feat: add resolver link import` only if the resolver ships.

---

### Task 12: Blur pill navigation

**Files:**
- Modify: `src/components/TabBar.tsx`
- Modify: `src/AppShell.tsx`
- Modify: `src/screens/SettingsScreen.tsx`
- Modify: `src/screens/CatalogScreen.tsx`
- Modify: `src/screens/ImportScreen.tsx`
- Modify: `src/screens/LibraryScreen.tsx`
- Modify: `app.json` only if a plugin is needed

- [ ] `npx expo install expo-blur` and confirm the SDK 58 version.
- [ ] Replace the gradient tab bar with a floating pill: 16px side margins, bottom margin `insets.bottom + 12`, 64px tall, radius 32, `BlurView` over a translucent `surface` fill, 1px `#ffffff14` border, soft shadow.
- [ ] Keep Library, Catalog and Import tabs; filled active icon plus white label, outline inactive plus dim label; `accessibilityRole="tab"` and selected state.
- [ ] Android fallback: the translucent fill must look correct where blur is unavailable; enable the documented Android blur method where available.
- [ ] The mini-player sits above the pill with the existing 8px gap; update list and Settings bottom padding for 64px plus margins.
- [ ] Web: verify blur or the fallback renders in the preview.
- [ ] Device: scroll content under the pill, check label contrast over art, no layout jump when the mini-player appears.
- [ ] Commit `feat: add blur pill tab bar`.

---

### Task 13: Settings growth and polish

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`
- Modify: `src/screens/NowPlayingScreen.tsx`

- [ ] Library: rescan, scan switch, import moved to its tab, exclude all, hidden restore.
- [ ] Playback: shuffle default, sleep timer presets/status.
- [ ] Lyrics: network lookup switch and cached count, only when Task 4 ships.
- [ ] Editing: explain scanned vs imported write access.
- [ ] About: version from `app.json` and the current ABI.
- [ ] No placeholder rows for unshipped features.
- [ ] Commit `feat: add playback settings`.

---

### Task 14: Release packaging and APK size

**Files:**
- Modify: `.github/workflows/release.yml` only if the ABI or notes change
- Modify: `docs/spec.md` with the measured result

- [ ] Record the current universal APK size (about 76MB) and the arm64-only size (about 24-25MB).
- [ ] Keep the arm64-only release build: `-PreactNativeArchitectures=arm64-v8a`.
- [ ] Keep an optional universal build or flag for emulator testing, clearly named.
- [ ] Release notes include the ABI and the measured size.
- [ ] Acceptance: the published phone APK is under about 30MB and installs over the previous signature.
- [ ] Commit `build: document arm64 release size` if anything changes.

---

### Task 15: Stretch, only after the above

- [ ] Batch edit: selection mode in Library, apply shared fields, reuse the writer per file with progress and partial-failure reporting.
- [ ] Android Auto / media browser research: test `expo-audio` against the playlist engine and record whether a small native path exists. Build only if it is small and native.

---

## Acceptance

- Notification and lock-screen next/previous work, play/pause state is never stale, artwork appears, and adjacent tracks are gapless.
- Shuffle preserves the current track, disables cleanly, and interacts sanely with repeat.
- The sleep timer fades and stops, cancels cleanly, and survives track changes.
- `.lrc` sidecars and LRCLIB lyrics highlight and auto-scroll; offline mode never crashes.
- Editing tags writes real file tags on imported copies; scanned files work after a write grant; failures leave originals intact.
- Every track action is an in-app sheet; delete always needs the in-app confirmation.
- Playlists and favorites persist across restarts; Liked Songs and playlist queues play correctly.
- Scanning is opt-in, hidden tracks restore, and the last track/position resumes after restart.
- Albums and Artists live in one Catalog tab; Import is its own tab; the phone UI exposes both.
- The tab bar is a floating blur pill and stays legible over artwork.
- Link import either works through a documented resolver or is visibly disabled; no scraping.
- The published phone APK is arm64-only and under about 30MB; CI builds it explicitly.
