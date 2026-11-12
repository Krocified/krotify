# v3 Delight and Ownership Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` task-by-task. Steps use checkbox tracking.

**Goal:** Turn Krotify into a player that shapes the listening session (shuffle, sleep timer, gapless, local lyrics) and lets the owner fix the files themselves (tag and artwork editing that survives outside the app).

**Architecture:** One `AudioPlaylist` engine replaces the single-player audio path so lock-screen next/previous and gapless are native; the timer-based mock engine stays for demo tracks. Shuffle is a queue-order layer above the playlist window. Sleep and lyrics are session features with pure, tested helpers in `src/lib/`. Tag editing is a local Expo native module (jaudiotagger) wrapped by a TypeScript service that keeps writes atomic and re-reads the cache.

**Tech Stack:** Expo SDK 58, RN 0.88, TypeScript strict, `expo-audio` (`AudioPlaylist`), `expo-sqlite`, `expo-file-system`, `@missingcore/react-native-metadata-retriever`, Ionicons, a local Kotlin Expo module with jaudiotagger.

**Spec:** `docs/spec.md` v3 section.

## Global Constraints

- Android only. Dev build required; no Expo Go.
- Local files only. No lyrics or metadata fetch from the network.
- Crossfade is dropped. Gapless comes from `AudioPlaylist`; do not add a second playback engine.
- Link import goes through a resolver service, never direct scraping. Only
  content the user has the rights to download; document the legal check.
- Any tag write is explicit, confirmed, atomic (temp file then replace) and followed by a re-read. A failed write leaves the original intact.
- Scanned files are written only after `MediaStore.createWriteRequest` grants access; otherwise offer "import a copy".
- No new runtime dependency without an Expo-compatible version check first.
- Icons are Ionicon names. Comments are plain, no shorthand.
- Every non-trivial pure helper gets a `node --test` test. Run `npm test`, `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform web` before a task is done.
- Conventional Commits. No push without explicit instruction.

## Review Focus

1. **Write failure:** a rejected/cancelled tag write, disk-full, or provider error leaves the file playable and unchanged, and the UI says so.
2. **Unsupported containers:** FLAC/OGG/WAV/MP4 paths either work or refuse before touching the file; no corrupt output.
3. **Playlist window edges:** notification next/prev, shuffle and repeat can never strand playback at a window boundary or replay the wrong index.
4. **Timer and fade:** cancelling, changing tracks, or stop() never leaves a running fade, a muted volume, or a late stop.
5. **Lyrics sync:** bad encoding, missing sidecar, or malformed timestamps never crash Now Playing or scroll to nowhere.
6. **Sheets and destructive actions:** every sheet traps focus, closes on back,
   and a delete is never triggered without an in-app confirmation.

---

## File Map

| File | Responsibility |
|---|---|
| `src/player/audioEngine.ts` | `AudioPlaylist` window, lock-screen options, volume, loop |
| `src/player/PlayerProvider.tsx` | app queue/index, shuffle, sleep timer, sync with playlist events |
| `src/lib/playlistWindow.ts` | pure window math for the playlist |
| `src/lib/shuffle.ts` | pure shuffle order and restore |
| `src/lib/sleepTimer.ts` | pure countdown/fade math |
| `src/lib/lrc.ts` | `.lrc` parser |
| `src/library/lyrics.ts` | sidecar discovery and file read |
| `src/lib/tagPatch.ts` | validation and normalization of edit fields |
| `src/library/tagWriter.ts` | TS wrapper over the native tag module |
| `modules/audio-tags/` | local Expo module: jaudiotagger read/write, atomic replace, write requests |
| `src/screens/EditTrackScreen.tsx` | metadata edit form and save flow |
| `src/components/TrackActionsSheet.tsx` | in-app long-press action sheet |
| `src/components/ConfirmSheet.tsx` | in-app destructive confirmation |
| `src/screens/CatalogScreen.tsx` | Albums/Artists segmented catalog |
| `src/screens/ImportScreen.tsx` | local import plus link-import entry |
| `src/library/linkImport.ts` | resolver client, progress, save-to-library |
| `src/screens/NowPlayingScreen.tsx` | shuffle, art/lyrics mode, sleep indicator |
| `src/components/LyricsPanel.tsx` | timed lyric list, active-line scroll, seek on tap |
| `src/screens/SettingsScreen.tsx` | Playback section (shuffle default, sleep timer), editing notes |
| `tests/playlistWindow.test.ts` | window edges |
| `tests/shuffle.test.ts` | order, restore, repeat interaction |
| `tests/sleepTimer.test.ts` | countdown, fade window, cancel |
| `tests/lrc.test.ts` | timestamps, offsets, malformed lines |
| `tests/tagPatch.test.ts` | validation, empty patches, artwork rules |

---

### Task 1: AudioPlaylist engine and lock-screen controls

**Files:** `src/player/audioEngine.ts`, `src/player/PlayerProvider.tsx`, `src/lib/playlistWindow.ts`, `tests/playlistWindow.test.ts`

**Interfaces:**
- `playlistWindow(index, length, radius = 4): { start: number; end: number; localIndex: number }`
- `createEngine(): { playlist, loadWindow(tracks, index), skipTo(local), setVolume(v), stop() }`
- Player context keeps its existing shape; internals move to a window of resolved URIs.

- [ ] Write failing window tests: edges at 0, middle, last; length smaller than radius+1.
- [ ] Implement `playlistWindow`.
- [ ] Replace the single player with `createAudioPlaylist`; resolve the window with the existing `resolveUri` ref, `skipTo(localIndex)`, `play()`.
- [ ] Set `setActiveForLockScreen(true, metadata, { showNextTrack: true, showPreviousTrack: true, showSeekBackward: true, showSeekForward: true })` and map `playlist.loop` to repeat.
- [ ] Sync playback state and metadata on every play/pause/track change so the
  notification play/pause icon is never stale. Update `updateLockScreenMetadata`
  on track change, including `artworkUrl` when the track has real art.
- [ ] Provide a proper monochrome notification small icon via a config plugin and
  Android drawable; verify it renders instead of a blank/placeholder icon.
- [ ] Spike visualizer feasibility in a MediaStyle notification. Android does not
  support live animated RemoteViews there; if it cannot be done reliably, use a
  static waveform glyph or omit it and record the decision.
- [ ] Listen to `trackChanged`; update app index/track and rebuild the window when it reaches an edge.
- [ ] Route app next/previous/skipNext/skipPrevious through the playlist; keep the mock engine untouched.
- [ ] Verify on device: notification next/prev changes tracks, play/pause icon
  matches state, artwork appears, gapless between adjacent tracks, screen locked.
- [ ] Commit `feat: move playback to playlist engine`.

---

### Task 2: Shuffle

**Files:** `src/lib/shuffle.ts`, `src/player/PlayerProvider.tsx`, `src/screens/NowPlayingScreen.tsx`, `tests/shuffle.test.ts`

**Interfaces:**
- `shuffleOrder(queue, keepIndex, random): { order: Track[]; index: number }`
- `restoreOrder(original, currentId): { order: Track[]; index: number }`
- Context: `shuffle: boolean`, `toggleShuffle(): void`.

- [ ] Tests: no dropped/duplicated tracks, current track first, deterministic with seeded RNG, restore places the current track correctly.
- [ ] Implement pure helpers.
- [ ] Player keeps `originalQueue`; enabling shuffles the remainder after the current track; disabling restores the original at the current track.
- [ ] Repeat one continues to replay the current track; next/previous follow the shuffled order.
- [ ] Shuffle button in the transport (Ionicons `shuffle`, accent when on) with a11y state.
- [ ] Commit `feat: add shuffled playback`.

---

### Task 3: Sleep timer

**Files:** `src/lib/sleepTimer.ts`, `src/player/PlayerProvider.tsx`, `src/screens/SettingsScreen.tsx`, `tests/sleepTimer.test.ts`

**Interfaces:**
- `SLEEP_PRESETS = [15, 30, 45, 60, 'end']` minutes plus end-of-track.
- `tickSleep(remainingMs, elapsedMs): { remainingMs, fadeFrom: number | null, done: boolean }`
- Context: `sleep: { mode: 'off' | 'timer' | 'end'; remainingMs }`, `setSleep(mode, minutes?)`.

- [ ] Tests: countdown, last-10s fade window, completion, cancel.
- [ ] Implement timer state; fade volume from 1 to 0 over the last 10s, restore volume on cancel/stop, stop at the end.
- [ ] End-of-track mode stops when the current track finishes (`handleEnd` hook).
- [ ] Settings Playback section: preset chips and Cancel; show remaining time while armed.
- [ ] Device: fade audible, stop happens, cancel never leaves volume at 0.
- [ ] Commit `feat: add sleep timer`.

---

### Task 4: Lyrics (.lrc and LRCLIB)

**Files:** `src/lib/lrc.ts`, `src/library/lyrics.ts`, `src/library/lrclib.ts`, `src/components/LyricsPanel.tsx`, `src/screens/NowPlayingScreen.tsx`, `tests/lrc.test.ts`

**Interfaces:**
- `parseLrc(text): { lines: { atMs: number; text: string }[]; offsetMs: number }`
- `findLyricsFile(track): Promise<string | null>` (same basename `.lrc`, then a `Lyrics/` sibling folder)
- `fetchLrclibLyrics(track): Promise<{ kind: 'synced' | 'plain' | 'instrumental' | 'none'; text?: string }>`
- `useLyrics(track)` resolves sidecar, then cache, then LRCLIB on demand.

LRCLIB rules:
- Base `https://lrclib.net`; use `GET /api/get?track_name=&artist_name=&album_name=&duration=`.
- Identify the client: `User-Agent: Krotify <version> (https://github.com/Krocified/krotify)`, or `X-User-Agent` on web.
- Sequential requests only, 200-500ms between, single lookup per user action; never bulk prefetch.
- Cache successes and 404s locally (SQLite or AsyncStorage) keyed by track id; sidecar wins over network.
- On 429, honor `Retry-After` plus jitter; on 5xx, show retry, never spam.
- No publish/flag calls. Only title, artist, album and duration are sent.

- [ ] Tests: LRC timestamps, multiple timestamps per line, `[offset:]`, CRLF, malformed lines skipped.
- [ ] Implement parser and sidecar discovery via `expo-file-system`.
- [ ] Implement the LRCLIB client with identification, duration matching (±2s), cache and error mapping.
### Now Playing layout revamp

- [ ] Keep two modes on the same screen. **Art mode** is the current full layout. **Lyrics mode** keeps the art visible: shrink the cover to about 200px (min 160) at the top, keep title/artist under it, and give the rest of the height to `LyricsPanel`.
- [ ] Backdrop, top controls and bottom transport/progress stay fixed in both modes; only the cover, title block and lyric area reflow. Use a 200ms crossfade/height transition, no bounce.
- [ ] Add a lyrics control (Ionicons `document-text-outline`, accent when active) in the top bar, with `accessibilityLabel` and selected state.
- [ ] `LyricsPanel`: scrollable lines, active line in `colors.text` at full size, surrounding lines dim; auto-scroll the active line to about one third of the panel; tapping a line seeks to its timestamp. Screen readers get a labelled list, no per-line live announcements.
- [ ] No lyrics or failed lookup: stay in art mode and show a small "Lyrics not found" note only after the user asks; never an empty full screen.
- [ ] Check small screens and long lines: no overlap with the transport, titles truncate, lyrics wrap.
- [ ] Device: toggle art/lyrics, confirm art stays visible, sync scroll, tap-to-seek, progress keeps updating.
- [ ] Offline with no cache: show "No lyrics" after the request fails, no crash.
- [ ] Device: synced scroll on a real `.lrc` and a fetched LRCLIB result.
- [ ] Commit `feat: add local and LRCLIB lyrics`.

---

### Task 5: Tag writer spike and native module

**Files:** `modules/audio-tags/` (new local Expo module), `src/library/tagWriter.ts`, `src/lib/tagPatch.ts`, `tests/tagPatch.test.ts`

**Interfaces:**
- Native: `readTags(uri): Promise<TagFields>`, `writeTags(uri, fields, artworkUri?): Promise<TagFields>`
- TS: `applyTagEdit(track, patch): Promise<Track>` handles atomic write, cache update, and typed errors.
- `validateTagPatch(patch): { ok: true; value } | { ok: false; errors }`

- [ ] Spike first: build a minimal jaudiotagger write on a copied MP3, verify with the metadata retriever, then decide keep/replace. Record the result in this plan or the spec.
- [ ] Implement validation tests for empty edits, numeric fields, artwork mime/size.
- [ ] Native write path: temp file in the same directory, write tags, `File.move`/rename replace, re-open and read back.
- [ ] Wrapper updates the SQLite metadata cache and returns the refreshed track.
- [ ] Device: edit an imported copy, confirm the file keeps tags after reinstall/another app.
- [ ] Commit `feat: add native tag writer`.

---

### Task 6: Write access and edit UI

**Files:** `modules/audio-tags/` (write request), `src/screens/EditTrackScreen.tsx`, `src/components/TrackActionsSheet.tsx`, `src/components/ConfirmSheet.tsx`, `src/AppShell.tsx`, `src/screens/LibraryScreen.tsx`

**Interfaces:**
- Native: `requestWriteAccess(uris): Promise<string[]>` using `MediaStore.createWriteRequest` on Android 11+.
- Screen props: `{ track, onSaved(track), onClose }`.

- [ ] Request write access for scanned tracks before the edit flow; deny → offer "Import a copy and edit" reusing the import path.
- [ ] Form: title, artist, album, album artist, track/disc number, year, genre, artwork picker (system file picker, image mime), Save/Cancel, busy and error states.
- [ ] On save: validate, write, re-read, update `tracks`, close with the refreshed track.
- [ ] Replace every management `Alert.alert` with an in-app sheet. Long-press a
  track opens `TrackActionsSheet` with Details, Edit metadata, Rename, Exclude,
  Delete, Cancel. Delete opens `ConfirmSheet` naming the track. Settings bulk
  actions use `ConfirmSheet` too.
- [ ] Details shows read-only title, artist, album, album artist, track/year,
  genre, duration, format, file size and path when available.
- [ ] Rename edits the title only (quick path), then flows through the same
  validator/writer and updates lists.
- [ ] Sheet style: bottom sheet on `surface`, 20px top radius, grabber, dimmed
  backdrop, slide-up 200ms, tap backdrop or Android back to close, Escape on
  web, focus trapped while open. No native dialogs anywhere.
- [ ] Entry points: long-press in Library and album/artist detail; imported and
  scanned tracks both show it.
- [ ] Device: sheet open/close, rename, delete confirmation, cancel permission,
  failed write, successful write, artwork change.
- [ ] Commit `feat: edit track metadata and artwork`.

---

### Task 7: Catalog consolidation and Import tab

**Files:** `src/screens/CatalogScreen.tsx`, `src/screens/ImportScreen.tsx`, `src/AppShell.tsx`, `src/components/TabBar.tsx`, `src/screens/SettingsScreen.tsx`

- [ ] One `CatalogScreen` with a segmented Albums/Artists control, reusing the existing list and detail components. One tab in `TabBar` replaces the two hidden entries; re-enable on phone.
- [ ] New `ImportScreen` tab: the existing local picker and recent imports, with progress, empty and error states.
- [ ] Move the import control out of Settings; keep exclude-all there.
- [ ] Local import keeps its AsyncStorage index and dedupe.
- [ ] Device: catalog segments, import a local file, tab persistence.

### Task 8: Link import spike (YouTube to MP3, planned)

**Files:** `src/library/linkImport.ts`, `src/screens/ImportScreen.tsx`

- [ ] Spike a resolver first: self-hosted yt-dlp service or a licensed converter API. Record legal/terms constraints and the request/response shape. No direct scraping in the client, ever.
- [ ] Client: paste URL, call the resolver, receive audio plus title/artist/artwork/duration, save into app storage, add to imports, show progress and cancel.
- [ ] Failure states: unsupported link, blocked/private video, resolver offline, disk full.
- [ ] Rights gate: only content the user has the rights to download; explain this in the UI.
- [ ] If no acceptable resolver exists, ship the section disabled with a clear note rather than a broken flow.

### Task 9: Blur pill navigation

**Files:** `src/components/TabBar.tsx`, `src/AppShell.tsx`, screen bottom paddings, `app.json` if a plugin is needed

- [ ] `npx expo install expo-blur` after confirming the SDK-compatible version.
- [ ] Replace the tab bar gradient with a floating pill: 16px side margins, bottom
  margin of `insets.bottom + 12`, 64px tall, radius 32, `BlurView` over a
  translucent `surface` fill, 1px `#ffffff14` border, soft shadow, no top border
  or fade.
- [ ] Keep Library/Catalog/Import rows, filled active icon + white text, outline
  inactive + dim text, `accessibilityRole="tab"` and selected state.
- [ ] Android blur fallback: translucent fill must look correct where
  `expo-blur` does not blur; enable the documented Android blur method where
  available.
- [ ] Mini-player sits above the pill with the existing 8px gap; update list and
  Settings bottom padding for the new 64px pill plus margins.
- [ ] Web: verify the blur or translucent fallback renders in the preview.
- [ ] Device: scroll content under the pill, check contrast of labels over art,
  no layout jump when the mini-player appears.
- [ ] Commit `feat: add blur pill tab bar`.

### Task 10: Settings growth and polish

**Files:** `src/screens/SettingsScreen.tsx`, `src/screens/NowPlayingScreen.tsx`

- [ ] Playback section: shuffle default (session), sleep timer presets/status.
- [ ] Lyrics section only when the sidecar feature ships; no placeholder rows.
- [ ] Editing section explains scanned vs imported write access.
- [ ] Commit `feat: add playback settings`.

---

### Task 11: Release packaging and APK size

**Files:** `.github/workflows/release.yml`, `docs/spec.md` if the packaging note
changes.

- [ ] Record the current universal APK size from the latest release (about 76MB)
  and the arm64-only local build (about 24MB).
- [ ] Build release with `-PreactNativeArchitectures=arm64-v8a`; confirm the APK
  installs and plays on an arm64 phone.
- [ ] Keep an optional universal job or flag for emulator testing, clearly named.
- [ ] Release notes include the ABI and the size.
- [ ] Acceptance: the published phone APK is under ~30MB and installs over the
  previous release signature.
- [ ] Commit `build: ship arm64 release apk`.

### Task 12: Stretch, only after the above

- [ ] Batch edit: selection mode in Library, apply shared fields, reuse the native writer per file with progress and partial-failure reporting.
- [ ] Android Auto / media browser research: evaluate `expo-audio` limits against the AudioPlaylist engine; record findings, build only if the path is native and small.

---

## Acceptance

- Notification and lock-screen next/previous work; gapless between tracks.
- Shuffle preserves the current track, disables cleanly, and interacts sanely with repeat.
- Sleep timer fades and stops, cancels cleanly, and survives track changes.
- `.lrc` sidecars highlight and auto-scroll; no network.
- Editing tags writes real file tags on imported copies; scanned files work after a write grant; failures leave originals intact.
- Settings shows only shipped options.
- Albums and Artists live in one Catalog tab; Import is its own tab; the phone UI exposes both.
- Link import either works through a documented resolver or is visibly disabled; no scraping.
- The tab bar is a floating blur pill with no gradient fade and remains legible over artwork.
- The published phone APK is arm64-only and under ~30MB; CI builds it explicitly.
