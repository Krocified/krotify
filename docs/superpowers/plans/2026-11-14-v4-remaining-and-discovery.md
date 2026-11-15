# v4 Remaining Work and Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) tracking. Conditional tasks start only after their gate is signed off.

**Goal:** Close the remaining v3 gaps and give v4 discovery an implementation path that starts only when its evidence, credentials, and legal gates are cleared.

**Architecture:** Remaining v3 items are local-first: a palette module for real-art backdrops, batch tag edits over the existing atomic writer, and a notification visualizer decision. v4 sources live in `src/discovery/` behind feature flags and never join the local queue. Radio Browser uses its own live-stream playback surface; Genius and Audiometa are opt-in metadata enrichment only.

**Tech Stack:** Expo SDK 58, RN 0.88, TypeScript, `expo-audio` (`AudioPlaylist`), `expo-sqlite`, `expo-file-system`, local Expo modules (Kotlin), AndroidX Palette, `fetch`.

**Spec:** `docs/spec.md` (v3, v4, External services). Research: `docs/research/v4-*-memo.md`, `docs/research/v3-batch-edit.md`, `docs/research/v3-link-import-resolver.md`, `docs/research/v3-android-auto.md`.

## Global Constraints

- Local playback works with no network and no account.
- Every network surface is opt-in, labelled, and separate from the local library.
- Identify the client (`User-Agent: Krotify <version> (...)` or `X-User-Agent` on web), honor rate limits, cache responses, show attribution.
- No scraping; no licensed lyric catalogue; LRCLIB remains the lyrics source.
- No dependency or network call without a reviewed decision memo.
- Tag writes stay explicit, confirmed, atomic, and followed by a re-read; failures leave the original intact.
- No comments unless non-obvious. Conventional Commits. No push without an explicit instruction.
- Every task ends with `npm test`, `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform web`.

## Review Focus

1. **Offline start:** palette, batch edit, and every discovery surface leave local scan/playback untouched when offline.
2. **Palette failure:** corrupt or missing artwork falls back to the hash gradient, never a black/blank backdrop.
3. **Batch partial failure:** one bad file is reported, later files continue, and no file is left half-written.
4. **Live stream failure:** a radio station that stalls, redirects, changes codec or goes offline is recoverable and never wedges local playback.
5. **Privacy and attribution:** only the minimum fields leave the device, and every adopted source shows its required credit.

---

## Gate Table

| Gate | Cleared when | Unblocks |
|---|---|---|
| G1 Palette dependency | Local AndroidX Palette module compiles in a dev build | Task 1 |
| G2 Batch edit UX | Research memo approved | Task 2 |
| G3 Link resolver | Licensed resolver chosen and legal review signed | Task 4 |
| G4 Genius | Credentials + terms review | Task 6 |
| G5 Audiometa | Account key + terms + 20-track match sample | Task 7 |
| G6 Radio | Real-device `AudioPlaylist` live-stream test passes | Task 8 |
| G7 Android Auto | A native media-browser path is approved | Task 5 (otherwise drop) |

---

## File Map

| File | Responsibility |
|---|---|
| `modules/palette/` | Local Expo module: artwork dominant color |
| `src/library/palette.ts` | Cache and fallback for artwork colors |
| `src/lib/batchEdit.ts` | Pure batch plan/validation |
| `src/screens/BatchEditScreen.tsx` | Selection, fields, progress, failures |
| `src/library/discovery.ts` | Shared cache, feature flags, attribution |
| `src/discovery/genius.ts` | Genius metadata client (gated) |
| `src/discovery/audiometa.ts` | Audiometa client (gated) |
| `src/discovery/radio.ts` | Radio Browser client (gated) |
| `src/screens/RadioScreen.tsx` | Separate radio surface (gated) |
| `src/screens/TrackDetailsScreen.tsx` | Read-only enrichment display |
| `docs/research/v4-implementation-gates.md` | Signed gate decisions |
| `tests/batchEdit.test.ts` | Batch planning/failure rules |
| `tests/discoveryCache.test.ts` | Cache/TTL/offline behavior |

---

### Task 1: Real-art backdrop (G1)

**Files:**
- Create: `modules/palette/expo-module.config.json`, `android/build.gradle`, Kotlin module
- Create: `src/library/palette.ts`
- Modify: `src/screens/NowPlayingScreen.tsx`
- Test: `tests/palette.test.ts`

**Interfaces:**
- Native `getDominantColor(uri: string): Promise<string | null>` using AndroidX Palette.
- `artworkColors(track: Track): Promise<[string, string]>` returns two colors or the hash gradient.
- Cache keyed by `track.id + artworkUri` in SQLite `artwork_palette`.

- [ ] Write failing tests for cache hit, missing artwork, native error, and hash fallback.
- [ ] Add the AndroidX Palette dependency to the local module and verify `expo prebuild` compiles it.
- [ ] Store dominant + muted colors; resolve from `artworkUri`, never copy or modify the file.
- [ ] Now Playing uses the extracted pair for the backdrop; text contrast stays legible (dim to ~35%).
- [ ] Web and no-artwork paths keep `coverColors(track.artworkHue)`.
- [ ] Device: real cover, generated cover, corrupt image, no crash.
- [ ] Commit `feat: extract real-art backdrop colors`.

---

### Task 2: Batch edit (G2)

**Files:**
- Create: `src/lib/batchEdit.ts`, `tests/batchEdit.test.ts`
- Create: `src/screens/BatchEditScreen.tsx`
- Modify: `src/AppShell.tsx`, `src/screens/LibraryScreen.tsx`
- Reuse: `applyTagEdit`, `TagFields`

**Interfaces:**
- `buildBatchPlan(tracks, patch): { items: { track; patch }[]; skipped: { track; reason }[] }`
- `applyBatch(plan, apply, onProgress): Promise<{ done; failed }>` sequential, stop-after-current.
- Fields: artist, album, albumArtist, genre. No title/artwork in batch v1.
- Progress: `{ current, total, trackTitle, failures }`.

- [ ] Tests: skip demo tracks, merge with existing tags, invalid patch, stop after current, per-file failure continues.
- [ ] Selection mode in Library with checkboxes; "Edit N tracks" opens the form.
- [ ] Apply sequentially through the existing atomic writer; never a second writer.
- [ ] Per-file result rows with Retry; failed file stays untouched and playable.
- [ ] Device: mixed imported/scanned set, one read-only file, cancel mid-batch.
- [ ] Commit `feat: add batch tag editing`.

---

### Task 3: Notification visualizer decision

**Files:**
- Modify: `plugins/with-notification-icon.js` only if the decision changes the glyph
- Create: `docs/research/v3-notification-visualizer.md`

- [ ] Spike MediaStyle RemoteViews: confirm live animation is not supported reliably.
- [ ] Decide: static waveform glyph (default) or omit. Do not fake an animation.
- [ ] Record the decision and leave the current monochrome icon if it already matches the decision.
- [ ] Device: notification icon renders in light and dark system themes.
- [ ] Commit `docs: record notification visualizer decision`.

---

### Task 4: Link import resolver (G3, conditional)

**Files:**
- Create: `src/library/linkImport.ts`
- Modify: `src/screens/ImportScreen.tsx`, `src/screens/SettingsScreen.tsx`

**Interfaces:**
- `resolveLink(url, signal): Promise<{ audioUrl; title; artist?; artworkUrl?; durationMs? }>`
- `LINK_IMPORT_ENABLED` stays false until G3.

- [ ] Gate: record the licensed resolver, terms, rights rule and rate limits in `v3-link-import-resolver.md`.
- [ ] Client only: paste URL, call resolver, download through the existing import path, save metadata, show progress/cancel.
- [ ] Failure states: unsupported, blocked/private, resolver offline, disk full.
- [ ] Rights-gate copy before the request; no direct scraping.
- [ ] Device: permitted link imports and plays; blocked link shows the right error.
- [ ] Commit `feat: add resolver link import` only after G3.

---

### Task 5: Android Auto (G7, otherwise drop)

**Files:**
- Create: `docs/research/v3-android-auto-decision.md`

- [ ] Confirm the current memo's drop verdict, or approve a native media-browser module.
- [ ] If approved, plan the browse tree, media session, and notification integration as a separate backend plan.
- [ ] Do not add half a media browser. Record adopt/drop and close the item.
- [ ] Commit `docs: record android auto decision`.

---

### Task 6: Genius metadata (G4, conditional)

**Files:**
- Create: `src/discovery/genius.ts`, `src/discovery/discoveryCache.ts`
- Create: `src/screens/TrackDetailsScreen.tsx` (read-only section)
- Modify: `src/screens/SettingsScreen.tsx`
- Test: `tests/discoveryCache.test.ts`, `tests/genius.test.ts`

**Interfaces:**
- `searchSong(query)`, `getSong(id)` with injected fetch.
- `enrichTrack(track): Promise<GeniusMetadata | null>`; never writes tags.
- Cache: success + not-found, TTL 30 days, keyed by normalized title/artist.

- [ ] Gate: credentials, auth flow and terms documented.
- [ ] Tests: response mapping, empty/partial data, 401/429/5xx, cache hit/expiry, offline.
- [ ] One opt-in action "Look up metadata" in track details; no automatic calls.
- [ ] Settings: enable/disable, data-sent copy, clear cache.
- [ ] Attribution and source link in the details section.
- [ ] Device: offline action disabled with a clear message; local playback unchanged.
- [ ] Commit `feat: add opt-in genius metadata`.

---

### Task 7: Audiometa enrichment (G5, conditional)

**Files:**
- Create: `src/discovery/audiometa.ts`
- Modify: `src/screens/TrackDetailsScreen.tsx`, `src/screens/SettingsScreen.tsx`
- Test: `tests/audiometa.test.ts`

**Interfaces:**
- `lookupTrack({ title, artist, album?, isrc? })`
- `applyEnrichedMetadata(track, patch)` only after user confirmation; uses `applyTagEdit`.

- [ ] Gate: account key, terms, rate limits, 20-track match sample with an agreed confidence rule.
- [ ] Tests: match/no-match, partial fields, 401/429, cache, offline.
- [ ] Read-only details first. A separate "Write these tags" action opts into the existing writer.
- [ ] Never auto-enrich or bulk-enrich in v1.
- [ ] Device: confirm a write survives a reload; cancel leaves tags untouched.
- [ ] Commit `feat: add opt-in audiometa enrichment`.

---

### Task 8: Radio Browser (G6, conditional)

**Files:**
- Create: `src/discovery/radio.ts`
- Create: `src/screens/RadioScreen.tsx`
- Modify: `src/components/TabBar.tsx` or catalog section, `src/AppShell.tsx`
- Test: `tests/radio.test.ts`

**Interfaces:**
- `discoverServers()`, `searchStations(query)`, `reportClick(uuid)`.
- `playStation(station)` uses a dedicated live `AudioPlaylist`; local queue is untouched.
- `stopRadio()` restores local playback controls.

- [ ] Gate: real-device playback of MP3, AAC and OGG streams through `AudioPlaylist`, including stall/redirect.
- [ ] Decide the surface: separate Radio section (default) or tab. Never mixed into the local queue.
- [ ] Tests: server fallback, search mapping, UUID stability, click reporting, offline.
- [ ] Separate player instance with `isLiveStream: true`; stop local audio before radio starts.
- [ ] Failure states: offline station, stalled stream, unsupported codec, empty results.
- [ ] Attribution + station metadata; report clicks.
- [ ] Device: start/stop radio, lock screen, local playback resumes after radio stops.
- [ ] Commit `feat: add opt-in internet radio`.

---

### Task 9: Cross-source shuffle

- [ ] Keep shuffle source-scoped. Radio has its own next/stop; no local+radio mixed queue.
- [ ] Record the rule in `docs/research/v4-shuffle-scope.md`. No code unless a later plan changes the product decision.

---

### Task 10: Device verification matrix and release notes

**Files:**
- Create: `docs/research/v3-device-check.md`

- [ ] Verify: lock-screen next/prev/gapless, catalog tap/long-press, sheets/back, blur/insets, scan prompt/deny/allow, resume after kill, tag write/deny/import-copy, real `.lrc`/LRCLIB/offline, playlist/favorite persistence.
- [ ] Capture `adb logcat -b crash` for any failure and link the trace.
- [ ] Record pass/fail per item; do not claim an untested pass.
- [ ] Add the release notes line for any newly shipped item.
- [ ] Commit `docs: record v3 device verification`.

---

## Acceptance

- Real-art backdrops use extracted colors when available and the hash fallback otherwise.
- Batch edit applies per-file atomically, reports every failure, and never corrupts a file.
- Link import stays disabled until a licensed resolver is signed off.
- Android Auto is explicitly dropped or moved to its own backend plan.
- No v4 source ships without its gate, memo, attribution, cache and offline behavior.
- Radio never mixes into the local queue and never wedges local playback.
- Device verification is recorded with evidence, not asserted.
