# v4 Gated Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry the remaining v3 and v4 items from `2026-11-14-v4-remaining-and-discovery.md` forward without shipping any external source before its evidence, credentials, and legal gates are cleared.

**Architecture:** Everything here is additive and separate from the local library. Palette extraction is a local AndroidX module with a hash fallback. Batch edit reuses the single atomic tag writer. Discovery clients live under `src/discovery/` behind flags; radio gets its own live player and never joins the local queue. Each network surface is opt-in, labelled, cached, and attributed.

**Tech Stack:** Expo SDK 58, RN 0.88, TypeScript, `expo-audio` (`AudioPlaylist`), `expo-sqlite`, `expo-file-system`, local Kotlin Expo modules, AndroidX Palette, `fetch`.

**Spec:** `docs/spec.md` (v3, v4, External services), `docs/intent.md`, `docs/research/v4-*-memo.md`, `docs/research/v3-batch-edit.md`, `docs/research/v3-link-import-resolver.md`, `docs/research/v3-android-auto.md`.

**Predecessor:** `docs/superpowers/plans/2026-11-14-v4-remaining-and-discovery.md`. This plan supersedes its sequencing and amends Tasks 4 and 8. Its detailed task bodies remain the reference for gated work.

## Amendments to the predecessor

- **Link import is hidden, not built.** `LINK_IMPORT_ENABLED` stays false and the disabled card is removed by the core plan. The resolver task is deferred until G3 and is not part of the v4 release.
- **Catalog is removed from the tab bar and routing.** The radio surface can no longer live in a Catalog section. It lives in Settings behind the radio flag, or as a dedicated screen opened from Settings.
- **Playlist schema is now v3.** The core plan adds `description` and `artworkUri`. This plan must not add a second playlist migration without a new version bump.
- **Artwork hydration moved out of Catalog.** Palette extraction must not assume Catalog's viewability callback exists.

## Global Constraints

- Local playback works with no network and no account.
- Every network surface is opt-in, labelled, and separate from the local library.
- Identify the client (`User-Agent: Krotify <version> (...)` or `X-User-Agent` on web), honour rate limits, cache responses, show attribution.
- No scraping; no licensed lyric catalogue; LRCLIB remains the lyrics source.
- No dependency or network call without a reviewed decision memo.
- Tag writes stay explicit, confirmed, snapshot-backed, atomic where possible, and followed by a re-read.
- No comments unless non-obvious. Conventional Commits. No push without an explicit instruction.
- Every task ends with `npm test`, `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform web`.

## Review Focus

1. **Palette failure:** corrupt or missing artwork falls back to the hash gradient, never a black or blank backdrop.
2. **Batch partial failure:** one bad file is reported, later files continue, and no file is left half-written.
3. **Live stream failure:** a station that stalls, redirects, changes codec or goes offline is recoverable and never wedges local playback.
4. **Privacy:** only the minimum fields leave the device, and every adopted source shows its required credit.
5. **Flag off:** every gated surface is fully absent when its flag is off, not a dead control.

---

## Gate Table

| Gate | Cleared when | Unblocks |
|---|---|---|
| G1 Palette dependency | Local AndroidX Palette module compiles in a dev build | Task 1 |
| G2 Batch edit UX | Research memo approved | Task 2 |
| G3 Link resolver | Licensed resolver chosen and legal review signed | Task 4 |
| G4 Genius | Credentials and terms review | Task 6 |
| G5 Audiometa | Account key, terms, and a 20-track match sample | Task 7 |
| G6 Radio | Real-device `AudioPlaylist` live-stream test passes | Task 8 |
| G7 Android Auto | A native media-browser path is approved | Task 5, otherwise drop |

---

## Task 1: Real-art backdrop (G1)

**Files:**
- Create: `modules/palette/expo-module.config.json`, `modules/palette/android/build.gradle`, Kotlin module
- Create: `src/library/palette.ts`
- Modify: `src/screens/NowPlayingScreen.tsx`, `src/db/schema.ts`, `src/db/repo.ts`
- Test: `tests/palette.test.ts`

**Interfaces:**
- Native: `getDominantColor(uri: string): Promise<string | null>`.
- TypeScript: `artworkColors(track: Track): Promise<[string, string]>`; returns the hash gradient on any failure.
- Cache: SQLite table `artwork_palette`, keyed by `track.id + artworkUri`, storing dominant and muted colors.

- [ ] **Step 1: Write failing tests for cache hit, missing artwork, native error, and hash fallback.**
- [ ] **Step 2: Verify the tests fail for the missing module.**
- [ ] **Step 3: Add the AndroidX Palette dependency to the local module and verify `npx expo prebuild --platform android --no-install` compiles it.**
- [ ] **Step 4: Store dominant and muted colors from `artworkUri`; never copy or modify the artwork file.**
- [ ] **Step 5: Use the pair for the Now Playing backdrop at roughly 35% opacity so text stays legible.**
- [ ] **Step 6: Keep `coverColors(track.artworkHue)` on web, no-artwork, corrupt-image, and native-error paths.**
- [ ] **Step 7: Device-check a real cover, a generated cover, and a corrupt image.**
- [ ] **Step 8: Run the full check and commit `feat: extract real-art backdrop colors`.**

## Task 2: Batch edit (G2)

**Files:**
- Create: `src/lib/batchEdit.ts`, `tests/batchEdit.test.ts`, `src/screens/BatchEditScreen.tsx`
- Modify: `src/AppShell.tsx`, `src/screens/LibraryScreen.tsx`
- Reuse: `applyTagEdit`, `TagFields`

**Interfaces:**
- `buildBatchPlan(tracks, patch): { items: { track; patch }[]; skipped: { track; reason }[] }`.
- `applyBatch(plan, apply, onProgress): Promise<{ done; failed }>`, sequential and stop-after-current.
- Editable fields: artist, album, albumArtist, genre. No title or artwork in batch v1.

- [ ] **Step 1: Write failing tests for demo-track skip, existing-tag merge, invalid patch, stop after current, and per-file failure continuing.**
- [ ] **Step 2: Implement the pure planner and runner.**
- [ ] **Step 3: Add a Library selection mode with checkboxes and an "Edit N tracks" action.**
- [ ] **Step 4: Apply sequentially through the existing atomic writer; do not add a second writer.**
- [ ] **Step 5: Show per-file result rows with Retry; a failed file stays untouched and playable.**
- [ ] **Step 6: Device-check a mixed imported/scanned set, one read-only file, and a cancel mid-batch.**
- [ ] **Step 7: Run the full check and commit `feat: add batch tag editing`.**

## Task 3: Notification visualizer decision

**Files:**
- Create: `docs/research/v3-notification-visualizer.md`
- Modify: `plugins/with-notification-icon.js` only if the decision changes the glyph

- [ ] **Step 1: Spike MediaStyle RemoteViews and confirm live animation is not reliably supported.**
- [ ] **Step 2: Decide static waveform glyph (default) or omit. Never fake an animation.**
- [ ] **Step 3: Record the decision and leave the current monochrome icon if it already matches.**
- [ ] **Step 4: Device-check the icon in light and dark system themes.**
- [ ] **Step 5: Commit `docs: record notification visualizer decision`.**

## Task 4: Link import resolver (G3, deferred)

**Files (when G3 clears):**
- Create: `src/library/linkImport.ts`
- Modify: `src/screens/ImportScreen.tsx`, `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Do nothing until G3. The core plan hides the card and keeps `LINK_IMPORT_ENABLED` false.**
- [ ] **Step 2: When G3 clears, record the resolver, terms, rights rule and rate limits in `v3-link-import-resolver.md`.**
- [ ] **Step 3: Add the client only: paste URL, resolve, download through the fixed import path, save metadata, show progress and cancel.**
- [ ] **Step 4: Cover unsupported, blocked/private, resolver offline, and disk full.**
- [ ] **Step 5: Require the rights-gate copy before the request; never scrape.**
- [ ] **Step 6: Device-check a permitted import and a blocked link.**
- [ ] **Step 7: Commit only after G3: `feat: add resolver link import`.**

## Task 5: Android Auto decision (G7)

**Files:**
- Create: `docs/research/v3-android-auto-decision.md`

- [ ] **Step 1: Confirm the memo's drop verdict, or approve a native media-browser module.**
- [ ] **Step 2: If approved, plan the browse tree, media session, and notification integration as a separate backend plan.**
- [ ] **Step 3: Record adopt or drop and close the item.**
- [ ] **Step 4: Commit `docs: record android auto decision`.**

## Task 6: Genius metadata (G4)

**Files:**
- Create: `src/discovery/genius.ts`, `src/discovery/discoveryCache.ts`, `tests/genius.test.ts`
- Modify: `src/screens/EditTrackScreen.tsx` (read-only details section), `src/screens/SettingsScreen.tsx`

**Interfaces:**
- `searchSong(query)`, `getSong(id)` with injected `fetch`.
- `enrichTrack(track): Promise<GeniusMetadata | null>`; never writes tags.
- Cache success and not-found, TTL 30 days, keyed by normalised title and artist.

- [ ] **Step 1: Gate: document credentials, auth flow and terms.**
- [ ] **Step 2: Write failing tests for response mapping, empty/partial data, 401/429/5xx, cache hit/expiry, and offline.**
- [ ] **Step 3: Implement the client and cache.**
- [ ] **Step 4: Add one opt-in "Look up metadata" action in track details; no automatic calls.**
- [ ] **Step 5: Add Settings enable/disable, data-sent copy, and clear cache.**
- [ ] **Step 6: Show attribution and the source link in the details section.**
- [ ] **Step 7: Device-check offline disabled with a clear message; local playback unchanged.**
- [ ] **Step 8: Run the full check and commit `feat: add opt-in genius metadata`.**

## Task 7: Audiometa enrichment (G5)

**Files:**
- Create: `src/discovery/audiometa.ts`, `tests/audiometa.test.ts`
- Modify: `src/screens/EditTrackScreen.tsx`, `src/screens/SettingsScreen.tsx`

**Interfaces:**
- `lookupTrack({ title, artist, album?, isrc? })`.
- `applyEnrichedMetadata(track, patch)` only after confirmation, through `applyTagEdit`.

- [ ] **Step 1: Gate: account key, terms, rate limits, and a 20-track match sample with an agreed confidence rule.**
- [ ] **Step 2: Write failing tests for match/no-match, partial fields, 401/429, cache, and offline.**
- [ ] **Step 3: Show read-only details first. A separate "Write these tags" action opts into the existing writer.**
- [ ] **Step 4: Never auto-enrich or bulk-enrich in v1.**
- [ ] **Step 5: Device-check a write survives reload; cancel leaves tags untouched.**
- [ ] **Step 6: Run the full check and commit `feat: add opt-in audiometa enrichment`.**

## Task 8: Radio Browser (G6)

**Files:**
- Create: `src/discovery/radio.ts`, `src/screens/RadioScreen.tsx`, `tests/radio.test.ts`
- Modify: `src/screens/SettingsScreen.tsx`, `src/AppShell.tsx`
- Do **not** modify `src/components/TabBar.tsx`: Catalog is gone and radio is not a tab.

**Interfaces:**
- `discoverServers()`, `searchStations(query)`, `reportClick(uuid)`.
- `playStation(station)` uses a dedicated live `AudioPlaylist`; the local queue is untouched.
- `stopRadio()` restores local playback controls.

- [ ] **Step 1: Gate: real-device playback of MP3, AAC and OGG streams through `AudioPlaylist`, including stall and redirect.**
- [ ] **Step 2: Surface: a screen opened from Settings behind `RADIO_ENABLED`, not a Catalog section and not a tab.**
- [ ] **Step 3: Write failing tests for server fallback, search mapping, UUID stability, click reporting, and offline.**
- [ ] **Step 4: Use a separate player instance with `isLiveStream: true`; stop local audio before radio starts.**
- [ ] **Step 5: Cover offline station, stalled stream, unsupported codec, and empty results.**
- [ ] **Step 6: Show attribution and station metadata; report clicks.**
- [ ] **Step 7: Device-check start/stop radio, lock screen, and local playback resuming after radio stops.**
- [ ] **Step 8: Run the full check and commit `feat: add opt-in internet radio`.**

## Task 9: Shuffle scope

- [ ] **Step 1: Keep shuffle source-scoped. Radio has its own next/stop; no mixed local and radio queue.**
- [ ] **Step 2: Record the rule in `docs/research/v4-shuffle-scope.md`. No code unless a later product decision changes it.**

## Task 10: Verification and release notes

- [ ] **Step 1: Run the core plan's device matrix plus each gated task's own device checks.**
- [ ] **Step 2: Record pass/fail with evidence in `docs/research/v4-device-check.md`; attach crash traces for failures.**
- [ ] **Step 3: Add a release-notes line only for items that actually shipped.**
- [ ] **Step 4: Commit `docs: record v4 expansion verification`.**

---

## Acceptance

- Palette backdrops use extracted colors when available and the hash fallback otherwise.
- Batch edit applies per file, reports every failure, and never corrupts a file.
- Link import stays hidden and disabled until a licensed resolver is signed off.
- Android Auto is explicitly dropped or moved to its own backend plan.
- No discovery source ships without its gate, memo, attribution, cache and offline behavior.
- Radio is reachable from Settings, never from a tab, and never mixes into the local queue.
- Every device claim has recorded evidence.
