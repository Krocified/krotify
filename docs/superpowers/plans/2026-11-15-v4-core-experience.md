# v4 Core Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the everyday player trustworthy and current: imports that play, tag edits that save, a back button that behaves, a like control in Now Playing, and a playlists screen worth using, with Catalog removed for now.

**Architecture:** Correctness first at the file boundary. Imports move to `expo-document-picker` because `File.pickFileAsync` gives Android document ids, not filenames. Tag writes add a MediaStore content-URI path through the existing local Kotlin module, keeping the atomic snapshot/restore contract in TypeScript. Navigation becomes one explicit back-intent resolver. Playlists gain a v3 schema (description, cover), a shared collection header, and drag reorder through `react-native-sortables`. Catalog is unwired but its file and grouping logic stay on disk for the later redesign.

**Tech Stack:** Expo SDK 58, React Native 0.88, TypeScript, `expo-audio` (`AudioPlaylist`), `expo-sqlite`, `expo-file-system`, `expo-document-picker` ~58.0.5, `@missingcore/react-native-metadata-retriever`, local Kotlin Expo module (jaudiotagger 3.0.1), `react-native-sortables` 1.10.1, `react-native-reanimated` 4.7.1, `react-native-worklets` 0.13.0, `react-native-gesture-handler` ~3.3.0, Ionicons.

**Spec:** `docs/spec.md` (v3 ownership, v4 section), `docs/intent.md`. Prior sequencing: `docs/superpowers/plans/2026-11-14-v4-remaining-and-discovery.md` (gated work; see `2026-11-15-v4-gated-expansion.md`).

## Decisions Locked

- **Catalog:** remove the tab and routing now. Keep `src/screens/CatalogScreen.tsx` and `src/lib/groups.ts` on disk, untouched, for the later redesign.
- **Link import:** hide the disabled "From a link" card. `LINK_IMPORT_ENABLED` stays false. No resolver work in this plan.
- **Playlist identity:** optional picked cover and description. Cover fallback order: picked image, then first available track artwork, then the generated hash cover from the playlist name.
- **Drag reorder:** `react-native-sortables` with Expo 58's pinned Reanimated 4 stack. Remove the up/down arrows. Keep accessible move actions for screen readers.
- **Like:** a heart button in the Now Playing top bar, immediately next to the sleep timer. Long-press still opens the management sheet; it is not the like path.

## Global Constraints

- Android first. A development build is required; Expo Go cannot prove audio, notification, MediaStore, or gesture work.
- Local playback works with no network and no account.
- Any tag write is explicit, confirmed, snapshot-backed, atomic where the filesystem allows, and followed by a re-read. A failed write leaves the original playable and unchanged.
- Never claim a device pass without running it on a device and recording the result.
- No new runtime dependency without `npx expo install` resolving the SDK-compatible version.
- No comments unless they explain a non-obvious decision. Conventional Commits. No push without an explicit instruction.
- Every task ends with `npm test`, `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform web`.
- Icons are Ionicon names. Copy uses no em dash.

## Review Focus

1. **MediaStore write denied or cancelled:** a scanned file must stay playable and unchanged, and the UI must explain the fallback instead of showing a raw exception.
2. **Opaque import provider:** a picker returning a document id, no extension, or a zero-byte cache copy must still produce a named, playable file or a clear per-file failure.
3. **Back at the root:** back must never exit from a tab or an open detail, and the double-press exit must only arm at the Library root.
4. **Drag cancel and rapid drags:** a cancelled drag, a drag during auto-scroll, or two fast drags must persist the last visible order and never strand a row or a native index.
5. **Playlist cover and migration:** an existing install must migrate to v3, and a missing or deleted cover must fall through to track artwork and then the generated cover without a blank surface.
6. **Catalog removal:** scanned and imported artwork must still appear in Library and Now Playing after Catalog's viewability hydrator is gone.

---

## File Map

| File | Responsibility |
|---|---|
| `src/lib/importName.ts` | Sanitized file names and MIME-to-extension resolution |
| `src/library/imports.ts` | `expo-document-picker` import, copy validation, dedupe |
| `src/library/artwork.ts` | Shared artwork hydration for Library and Now Playing after Catalog removal |
| `modules/audio-tags/android/.../AudioTagsModule.kt` | MediaStore content-URI writes, safe file replace, tag conversion, cause messages |
| `src/library/tagWriter.ts` | Snapshot/restore orchestration, typed errors, cause surfacing |
| `src/screens/EditTrackScreen.tsx` | Write-access state, fallback copy, save errors |
| `src/lib/backIntent.ts` | Pure back-action resolver |
| `src/components/Toast.tsx` | Exit hint and short inline notices |
| `src/AppShell.tsx` | Back handler, tab routing, Catalog unwiring, playback wiring |
| `src/components/TabBar.tsx` | Two tabs: Library and Import |
| `src/screens/NowPlayingScreen.tsx` | Heart button next to sleep timer |
| `src/screens/ImportScreen.tsx` | File import only; link card hidden |
| `src/db/schema.ts` | v3 playlist columns and migration list |
| `src/db/index.ts` | v3 migration runner |
| `src/db/repo.ts` | Playlist details, cover, bulk reorder |
| `src/lib/playlistOrder.ts` | Pure order helpers for accessible move actions |
| `src/lib/playlistView.ts` | Cover fallback and playlist meta |
| `src/library/playlistArtwork.ts` | Pick, validate, copy and delete playlist covers |
| `src/components/CollectionHeader.tsx` | Shared hero: cover, title, description, meta, play and shuffle |
| `src/components/PlaylistEditSheet.tsx` | Name, description and cover editor |
| `src/screens/PlaylistsScreen.tsx` | Playlist index and drag-reorder detail |

---

## Phase 0: Baseline and dependency stack

### Task 1: Verify baseline and add the gesture stack

**Files:**
- Modify: `package.json`, `App.tsx`
- Test: none (dependency task)

**Interfaces:**
- Produces: `react-native-sortables@1.10.1`, `react-native-reanimated@4.7.1`, `react-native-worklets@0.13.0`, `react-native-gesture-handler@~3.3.0`.
- Produces: `GestureHandlerRootView` wrapping the app root.

- [ ] **Step 1: Verify the current tree before touching it**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`
Expected: all pass. If not, stop and record the failing command before changing anything.

- [ ] **Step 2: Install the Expo-pinned gesture stack**

Run:
```bash
npx expo install react-native-reanimated react-native-worklets react-native-gesture-handler
npx expo install react-native-sortables@1.10.1
npx expo install --check
```
Expected: Reanimated 4.7.1, Worklets 0.13.0, Gesture Handler ~3.3.0, Sortables 1.10.1; `expo install --check` reports no fixes.

- [ ] **Step 3: Wrap the root in `GestureHandlerRootView`**

In `App.tsx`, import from `react-native-gesture-handler` and add `style={{ flex: 1 }}` on the root view. Keep `SafeAreaProvider`, `PlayerProvider`, `FavoritesProvider`, `AppShell`, and `StatusBar` in their current order.

- [ ] **Step 4: Rebuild the dev client**

Run: `npx expo run:android`
Expected: build installs and app launches. If Metro reports a Worklets version mismatch, stop; do not patch around it.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json App.tsx
git commit -m "build: add sortables gesture stack"
```

---

## Phase 1: Correctness

### Task 2: Import files with real names, extensions and tags

**Files:**
- Modify: `src/lib/importName.ts`, `src/library/imports.ts`, `src/screens/ImportScreen.tsx`, `src/AppShell.tsx`
- Test: `tests/importName.test.ts`
- Install: `expo-document-picker` via `npx expo install`

**Interfaces:**
- Produces: `extensionForMime(mime: string | undefined): string | null`.
- Changes: `importedFileName(raw: string, fallback: string, mime?: string): string`.
- Produces: `ImportFailure = { name: string; reason: string }`.
- Changes: `pickAndImportTracks(): Promise<{ tracks: Track[]; failures: ImportFailure[] }>` backed by `DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true, copyToCacheDirectory: true })`.
- Changes: `importTrackCopy(track): Promise<{ track: Track | null; failures: ImportFailure[] }>`.
- Changes: `ImportScreen` takes `importFailures: ImportFailure[]`.
- Changes: `AppShell.handleImport` consumes the new return shape and sets the failures state.

- [ ] **Step 1: Write the failing filename tests**

Add to `tests/importName.test.ts`:
```ts
test('adds the MIME extension when the provider name has none', () => {
  assert.equal(importedFileName('audio:1234', 'track-1.mp3', 'audio/mpeg'), 'audio-1234.mp3');
});

test('maps common audio MIME types', () => {
  assert.equal(extensionForMime('audio/mpeg'), 'mp3');
  assert.equal(extensionForMime('audio/mp4'), 'm4a');
  assert.equal(extensionForMime('audio/x-flac'), 'flac');
  assert.equal(extensionForMime('audio/ogg'), 'ogg');
  assert.equal(extensionForMime('application/octet-stream'), null);
});

test('keeps a real name and does not double the extension', () => {
  assert.equal(importedFileName('Song.mp3', 'track.mp3', 'audio/mpeg'), 'Song.mp3');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/importName.test.ts`
Expected: FAIL because `extensionForMime` is not exported and the extension branch is missing.

- [ ] **Step 3: Implement `extensionForMime` and extend `importedFileName`**

Rules: strip `document:`, `msf:`, and `content:` prefixes; decode URI encoding; replace `/\?%*:|"<>` and path separators with `-`; collapse whitespace; if the cleaned name has no extension and the MIME maps, append `.<ext>`; if it still has no extension, use the fallback's extension; never return empty.

- [ ] **Step 4: Install the document picker**

Run: `npx expo install expo-document-picker`
Expected: `expo-document-picker ~58.0.5` is added to `package.json` and the lockfile.

- [ ] **Step 5: Replace the picker in `pickAndImportTracks`**

Use `expo-document-picker`. For each asset, keep its `name`, `mimeType` and `size`. Copy from `asset.uri` (cache copy) into `imports/<stamp>-<index>/<name>`. Validate the destination exists, has a non-zero size, and matches `asset.size` when that size is known.

Dedupe by `hashString(name + ':' + (asset.size ?? destination.size))` when a size exists; when the provider reports no size, include the source `asset.uri` and the batch `stamp` in the key so two unknown-size files cannot collide. On a per-file failure, delete the partial copy and continue with the next asset; return `{ tracks, failures }` where `failures` carries the asset name and a short human reason (`no audio data`, `copy failed`, `unsupported`).

- [ ] **Step 6: Update the callers for the new return shape**

`AppShell.handleImport` destructures `{ tracks, failures }`, merges `tracks`, and stores `failures` for the Import screen. `importTrackCopy` returns `{ track, failures }`; the caller in `EditTrackScreen` uses `result.track` and shows `failures[0].reason` when no copy was made. `ImportScreen` receives `importFailures` and renders `N files could not be imported` plus the first reason below the import card. A thrown batch failure still uses the existing generic error.

- [ ] **Step 7: Hide the link card**

In `src/screens/ImportScreen.tsx`, remove the disabled "From a link" block, the `LINK_IMPORT_ENABLED` card, and the "From a link" section title. Leave `LINK_IMPORT_ENABLED` exported for the later resolver work.

- [ ] **Step 8: Verify on device**

Pick files from: Files app, Downloads, Google Drive, and an SD card if present. For each: the Library/Import row shows the real filename, the file plays, and a cold relaunch still plays it. Then pick a file the provider returns as a 0-byte copy and confirm it is reported, not listed.

- [ ] **Step 9: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/lib/importName.ts src/library/imports.ts src/screens/ImportScreen.tsx src/screens/EditTrackScreen.tsx src/AppShell.tsx tests/importName.test.ts package.json package-lock.json
git commit -m "fix(import): use document picker names and extensions"
```

### Task 3: Write tags to scanned and imported files

**Files:**
- Modify: `modules/audio-tags/android/src/main/java/expo/modules/audiotags/AudioTagsModule.kt`
- Modify: `modules/audio-tags/index.ts`, `src/library/tagWriter.ts`, `src/screens/EditTrackScreen.tsx`
- Test: `tests/tagWriter.test.ts`

**Interfaces:**
- Keeps: `writeTags(uri: string, fields: TagFields, artworkUri?: string): Promise<TagFields>`.
- Keeps: `requestWriteAccess(uris: string[]): Promise<string[]>`.
- Contract change: `requestWriteAccess` returns an original input URI only when it is actually writable: an app-owned `file://` path, or a `content://`/shared `file://` path for which the write request was granted. It returns an empty list for an unresolvable shared file, so `EditTrackScreen` offers the copy fallback instead of marking access granted.
- Produces: native `resolveContentUri(uriString: string): Uri?` internal to the module.
- Produces: native `isAppOwned(file: File): Boolean` (files dir, cache dir, or external files dir).
- Changes: every native write failure maps `EACCES`, `EPERM`, and `EROFS` to `NO_WRITE_ACCESS`.
- Changes: `TagWriteError` messages include the native cause message when it differs from the wrapper.

- [ ] **Step 1: Reproduce and capture the real cause**

Run the app, rename an imported track and a scanned track, then run:
```bash
adb logcat -c && adb logcat | grep -iE "audiotags|jaudiotagger|krotify" 
```
Record which path fails: `file://` imported copy, or `file://` scanned file under scoped storage. Do not change code before this record exists.

- [ ] **Step 2: Write the failing error-surfacing test**

In `tests/tagWriter.test.ts`, add a case where the native error has `message = 'Could not write tags to file:///x'`, `cause = new Error('bad frame')`, and `code = 'WRITE_FAILED'`. Assert the thrown `TagWriteError.message` contains both `Could not write tags` and `bad frame`. Also assert that a `NO_WRITE_ACCESS` error keeps its code and does not get rewritten to `WRITE_FAILED`.

- [ ] **Step 3: Add the MediaStore content-URI path in Kotlin**

- `resolveContentUri(fileUri)`: return the URI unchanged when it is `content://`. For `file://`, return `null` immediately unless `Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q`. On Q+, query `MediaStore.Audio.Media.getContentUri(volume)` for each name in `MediaStore.getExternalVolumeNames(context)` with `_data = ?`, and return the first hit.
- `requestWriteAccess`: for each input, if `isAppOwned(file)` return the original URI. Otherwise resolve to a content URI. On API 30+, call `MediaStore.createWriteRequest` with the resolved URIs and, on `RESULT_OK`, return only the original inputs that had a resolved URI. If an input is not app-owned and does not resolve, return an empty list for it. On API 29, return the original input and let `writeTags` decide; `createWriteRequest` does not exist there. On API 24 to 28, return the original input.
- `writeTags`: when a content URI resolves, copy the current content to a cache temp, apply the fields there, then open `contentResolver.openOutputStream(contentUri, "rwt")` and stream the temp back. Re-read the **written target** (copy the content URI to a fresh cache temp and read that, or read the file directly) and return those tags; never return tags read only from the pre-write temp. When the input is app-owned, keep the file temp-and-replace path. When the input is a shared `file://` that does not resolve, throw `NoWriteAccessException`.
- Replace the unconditional `Files.move(..., ATOMIC_MOVE)` with: try `ATOMIC_MOVE`; on `AtomicMoveNotSupportedException`, `UnsupportedOperationException`, or `FileAlreadyExistsException`, retry with `REPLACE_EXISTING`; on the final failure, throw with the cause message. Map `EACCES`, `EPERM`, and `EROFS` to `NO_WRITE_ACCESS`.
- `snapshotFile` and `restoreFile` must also support content URIs: snapshot a content URI to cache, restore a cache snapshot to the content URI via `openOutputStream("rwt")`.
- Include the cause in every thrown `TagWriteException`: `"Could not write tags to $uri: ${error.message}"`.

- [ ] **Step 4: Convert tags instead of throwing on ID3v1-only files**

In `applyFields`, use `audioFile.getTagAndConvertOrCreateAndSetDefault()` rather than `audioFile.tag ?: createDefaultTag()`. Set each field inside its own try/catch for `KeyNotFoundException`; skip unsupported keys, never abort the whole write for a missing advisory field.

- [ ] **Step 5: Surface the cause in TypeScript**

In `tagWriter.ts`, when mapping an unknown error, append `cause.message` only when it is not already contained in the wrapper message. In `EditTrackScreen.tsx`, keep the `NO_WRITE_ACCESS` fallback copy but show the native message for `WRITE_FAILED`.

- [ ] **Step 6: Verify the fallback is honest**

On a shared scanned file that cannot be written: `requestWriteAccess` returns no grant, `EditTrackScreen` shows "Read-only track" and "Import a copy and edit" before any save, and the original still plays. If a write is attempted anyway, `EACCES`/`EPERM`/`EROFS` maps to `NO_WRITE_ACCESS` and the same fallback appears. On an imported copy: rename succeeds, survives a cold relaunch, the row shows the new title, and re-reading the file returns the new tag. Test an MP3 with only ID3v1 tags and one with ID3v2.2 tags.

- [ ] **Step 7: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add modules/audio-tags src/library/tagWriter.ts src/screens/EditTrackScreen.tsx tests/tagWriter.test.ts
git commit -m "fix(tags): write scanned and imported files reliably"
```

---

## Phase 2: Experience

### Task 4: Back navigates before it exits

**Files:**
- Create: `src/lib/backIntent.ts`, `tests/backIntent.test.ts`, `src/components/Toast.tsx`
- Modify: `src/AppShell.tsx`, `src/screens/NowPlayingScreen.tsx`

**Interfaces:**
- Produces: `resolveBack(state: BackState): BackAction`.
- `BackState`: `{ sleepOpen; editOpen; likedOpen; playlistsOpen; openPlaylistId; screen; tab }`.
- `BackAction`: `'close-sleep' | 'close-edit' | 'close-liked' | 'close-playlist-detail' | 'close-playlists' | 'close-now-playing' | 'close-settings' | 'close-search' | 'tab-to-library' | 'arm-exit'`.
- Produces in `AppShell`: `registerBackInterceptor(fn: (() => boolean) | null)`; `NowPlayingScreen` registers a callback that closes the sleep panel and returns `true` while it is open, and `null` otherwise.
- Produces: `Toast({ visible, message, onHidden? })`.
- Note: bottom `Sheet`/`Modal` overlays already handle Android back through `Modal`'s `onRequestClose`; the resolver does not need cases for them. The sleep panel is inline, not a Modal, so it needs the interceptor.

- [ ] **Step 1: Write the failing resolver tests**

In `tests/backIntent.test.ts`, use a `state` fixture helper so every test is explicit:
```ts
const state = (over: Partial<BackState>): BackState => ({
  sleepOpen: false, editOpen: false, likedOpen: false, playlistsOpen: false,
  openPlaylistId: null, screen: 'library', tab: 'library', ...over,
});

test('closes the sleep panel before leaving Now Playing', () => {
  assert.equal(resolveBack(state({ sleepOpen: true, screen: 'nowPlaying' })), 'close-sleep');
});

test('closes the most recent overlay first', () => {
  assert.equal(resolveBack(state({ editOpen: true, likedOpen: true, playlistsOpen: true, openPlaylistId: 'p' })), 'close-edit');
  assert.equal(resolveBack(state({ likedOpen: true, playlistsOpen: true, openPlaylistId: 'p' })), 'close-liked');
  assert.equal(resolveBack(state({ playlistsOpen: true, openPlaylistId: 'p' })), 'close-playlist-detail');
  assert.equal(resolveBack(state({ playlistsOpen: true })), 'close-playlists');
});

test('leaves a tab for Library before arming exit', () => {
  assert.equal(resolveBack(state({ screen: 'import', tab: 'import' })), 'tab-to-library');
  assert.equal(resolveBack(state({})), 'arm-exit');
});

test('closes full-screen routes before tab navigation', () => {
  assert.equal(resolveBack(state({ screen: 'nowPlaying' })), 'close-now-playing');
  assert.equal(resolveBack(state({ screen: 'settings' })), 'close-settings');
  assert.equal(resolveBack(state({ screen: 'search' })), 'close-search');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/backIntent.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement `resolveBack` in priority order**

Order: sleep panel, edit, liked, playlist detail, playlists index, now playing, settings, search, tab to Library, arm exit. Return a single string union.

- [ ] **Step 4: Wire one `BackHandler` in `AppShell`**

Replace the current multi-branch handler with `resolveBack`. Keep the existing close callbacks for Now Playing (`closeNowPlayingRef`) and return-screen refs. Add `registerBackInterceptor` to the AppShell and call it first: if it returns `true`, the event is handled. `NowPlayingScreen` registers an interceptor that closes `sleepOpen` and returns `true` while the panel is open. For `arm-exit`, set an `exitArmedRef` timestamp and show `Press back again to exit`; a second back within 2000 ms calls `BackHandler.exitApp()`. Any other action clears the arm. Use refs so the listener is registered once and never closes over stale state.

- [ ] **Step 5: Add the Toast**

A small absolute pill above the tab bar, `Animated` opacity only, auto-hides after 1800 ms. Copy is sentence case, no em dash. It must not intercept touches.

- [ ] **Step 6: Verify on device**

From Library root, back once shows the hint, back twice exits. From Import, back returns to Library. From Now Playing, back returns to the screen that opened it. From a playlist detail, back returns to the playlist index. From Settings and Search, back returns to the previous screen. No path exits on the first press except a finished double press.

- [ ] **Step 7: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/lib/backIntent.ts tests/backIntent.test.ts src/components/Toast.tsx src/AppShell.tsx
git commit -m "fix(nav): back closes before it exits"
```

### Task 5: Like from Now Playing

**Files:**
- Modify: `src/screens/NowPlayingScreen.tsx`, `src/screens/LikedScreen.tsx`

**Interfaces:**
- Consumes: `useFavorites()` from `FavoritesProvider`.
- Produces: a heart `Pressable` in `topActions` between the sleep and lyrics buttons.

- [ ] **Step 1: Add the heart control**

Import `useFavorites`. Render a heart button with `accessibilityLabel` `Add <title> to Liked Songs` or `Remove <title> from Liked Songs`, `accessibilityState={{ selected: liked }}`. Use `heart` when liked and `heart-outline` when not; accent color when liked, `colors.textDim` when not. Call `toggle(track.id)` and ignore a rejection with the existing error note pattern. Do not add a long-press handler.

- [ ] **Step 2: Update the empty copy**

In `LikedScreen.tsx`, change the empty text to: `No liked songs yet. Tap the heart in Now Playing or in a track's action sheet.`

- [ ] **Step 3: Verify on device**

Open Now Playing, tap the heart: it fills, the Liked Songs count changes, and the track appears in Liked Songs. Tap again: it empties and disappears from Liked Songs. Rotate/relaunch and confirm persistence.

- [ ] **Step 4: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/screens/NowPlayingScreen.tsx src/screens/LikedScreen.tsx
git commit -m "feat(player): add like control beside sleep timer"
```

### Task 6: Remove Catalog without losing artwork

**Files:**
- Create: `src/library/artwork.ts`
- Modify: `src/AppShell.tsx`, `src/components/TabBar.tsx`, `src/types.ts`, `src/screens/LibraryScreen.tsx`, `src/library/metadata.ts`, `src/db/repo.ts`
- Keep: `src/screens/CatalogScreen.tsx`, `src/lib/groups.ts`
- Test: `tests/playlistView.test.ts` covers the playlist fallback; add a pure `mergeCachedMetadata` test to `tests/tagPatch.test.ts` or a new `tests/artwork.test.ts`.

**Interfaces:**
- Produces: `hydrateArtwork(tracks: Track[], onBatch: (updated: Track[]) => void, options?: { concurrency?: number; batchSize?: number; isCancelled?: () => boolean }): Promise<void>`.
- Produces: `mergeCachedMetadata(existing: CachedMetadata | null, patch: CachedMetadata): CachedMetadata` in `src/db/repo.ts`; an `undefined` `artworkUri` in the patch preserves the existing value.
- Changes: `putCachedMetadata` uses `mergeCachedMetadata` so enrichment cannot clobber a hydrated `artworkUri`.
- Changes: `TabName = 'library' | 'import'`; `ScreenName` drops `'catalog'`.
- Removes: `CatalogScreen` import and the `onArtworkLoaded` prop.

- [ ] **Step 1: Move artwork hydration out of Catalog**

Create `src/library/artwork.ts`. It selects tracks that have a `uri` and no `artworkUri`, avoids demo tracks, processes them in batches (default 20) with concurrency 2, calls `loadArtwork` from `metadata.ts`, and emits batches for `setLibraryTracks`. Keep a module-level in-flight set so a re-render does not duplicate work. Check `isCancelled` before each batch and stop when the caller changes library generation. Process the whole eligible set so later rows do not starve; this runs in the background and never blocks the list.

- [ ] **Step 2: Prevent enrichment from clobbering artwork**

Extract `mergeCachedMetadata(existing, patch)` and use it inside `putCachedMetadata`: a patch with `artworkUri === undefined` keeps the existing artwork URI; any other key still overwrites normally. Test the merge directly with a cache that has `artworkUri` and a patch that omits it.

- [ ] **Step 3: Wire hydration in `AppShell` after enrichment**

Call `hydrateArtwork` only after `enrichTracks` has delivered its final batch for the current library generation, and again after an import's enrichment finishes. Keep a `generationRef` and pass `isCancelled` so a rescan or import aborts the old hydration. Merge results by id. Do not hydrate on every render.

- [ ] **Step 4: Remove the Catalog tab**

- `TabBar.tsx`: `TABS` becomes `[library, import]`. Remove the catalog entry and the `albums` icon.
- `types.ts`: remove `'catalog'` from `ScreenName`.
- `AppShell.tsx`: remove the `CatalogScreen` import, the `activeTab === 'catalog'` branch, `handleArtworkLoaded`, and `showTabs` catalog handling. `activeTab` is `screen` when it is library or import, otherwise `tab`.
- Do not delete `CatalogScreen.tsx` or `groups.ts`.

- [ ] **Step 5: Verify on device**

After a cold launch, Library rows and Now Playing show scanned and imported artwork. Imported tracks show their embedded art without opening Catalog. Removing Catalog leaves no route or tab reference in TypeScript errors.

- [ ] **Step 6: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/library/artwork.ts src/AppShell.tsx src/components/TabBar.tsx src/types.ts src/screens/LibraryScreen.tsx
git commit -m "feat(catalog): remove tab and keep artwork hydration"
```

### Task 7: Playlist schema v3 and bulk reorder

**Files:**
- Modify: `src/db/schema.ts`, `src/db/index.ts`, `src/db/repo.ts`
- Test: `tests/migration.test.ts`

**Interfaces:**
- Produces: `Playlist = { id; name; createdAt; description?: string; artworkUri?: string }`.
- Produces: `updatePlaylistDetails(id: string, patch: { name?: string; description?: string; artworkUri?: string | null }): Promise<void>`.
- Produces: `reorderPlaylistTracks(playlistId: string, orderedIds: string[]): Promise<void>`.
- Produces: `pendingPlaylistColumnMigrations(existing: Iterable<string>): string[]`.
- Changes: `DB_VERSION = 3`.

- [ ] **Step 1: Write the failing migration test**

In `tests/migration.test.ts`, assert:
```ts
assert.equal(DB_VERSION, 3);
assert.deepEqual(
  pendingPlaylistColumnMigrations(['id', 'name', 'createdAt']),
  [
    'ALTER TABLE playlists ADD COLUMN description TEXT',
    'ALTER TABLE playlists ADD COLUMN artworkUri TEXT',
  ],
);
assert.deepEqual(pendingPlaylistColumnMigrations(['description', 'artworkUri']), []);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/migration.test.ts`
Expected: FAIL because the v3 list and bump do not exist.

- [ ] **Step 3: Add the schema and migration**

In `SCHEMA_SQL`, add `description TEXT` and `artworkUri TEXT` to the `playlists` table for fresh installs. Add `pendingPlaylistColumnMigrations`. In `db/index.ts`, inside the migration transaction, query `PRAGMA table_info(playlists)` and run the pending playlist column SQL alongside the existing track metadata migration.

- [ ] **Step 4: Add the repository functions**

`listPlaylists` selects the new columns. `updatePlaylistDetails` updates only the keys present in the patch; `artworkUri: null` writes SQL NULL.

`reorderPlaylistTracks` runs one transaction over **every** row, not only the ids in `orderedIds`. Read the current ids ordered by position, build `final = [...orderedIds that exist, ...current ids not in orderedIds]`, then set `position = (i + 1) * 1000` for each. This keeps rows whose tracks are missing from the local library from interleaving with the visible order. Ignore ids that are not in the playlist.

- [ ] **Step 5: Verify migration on a real install**

Install over the current build (not a clean install), open Playlists, create one, add a track. Confirm the app does not crash and the new columns exist with `PRAGMA user_version = 3`.

- [ ] **Step 6: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/db/schema.ts src/db/index.ts src/db/repo.ts tests/migration.test.ts
git commit -m "feat(playlists): add description cover and bulk reorder"
```

### Task 8: Playlist view helpers and cover storage

**Files:**
- Create: `src/lib/playlistOrder.ts`, `src/lib/playlistView.ts`, `src/library/playlistArtwork.ts`
- Test: `tests/playlistView.test.ts`, `tests/playlistOrder.test.ts`

**Interfaces:**
- Produces: `moveId(ids: string[], from: number, to: number): string[]`.
- Produces: `playlistArtwork(playlist: Playlist, tracks: Track[]): { uri?: string; hue: number }`.
- Produces: `pickPlaylistCover(playlistId: string): Promise<string | null>`, `removePlaylistCover(playlist: Playlist): Promise<void>`.

- [ ] **Step 1: Write the failing helper tests**

`tests/playlistOrder.test.ts`:
```ts
assert.deepEqual(moveId(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
assert.deepEqual(moveId(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
assert.deepEqual(moveId(['a'], 0, 0), ['a']);
```
`tests/playlistView.test.ts`:
```ts
const track: Track = { id: 't1', uri: 'file:///a.mp3', source: 'import', title: 'A', artist: '', album: '', durationMs: 1000, artworkHue: 0 };
assert.deepEqual(playlistArtwork({ id: 'p', name: 'Road', createdAt: 1, artworkUri: 'file:///cover.jpg' }, []), { uri: 'file:///cover.jpg', hue: hueFromSeed('pRoad') });
assert.deepEqual(playlistArtwork({ id: 'p', name: 'Road', createdAt: 1 }, [{ ...track, artworkUri: 'file:///a.jpg' }]).uri, 'file:///a.jpg');
assert.equal(playlistArtwork({ id: 'p', name: 'Road', createdAt: 1 }, []).uri, undefined);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/playlistOrder.test.ts tests/playlistView.test.ts`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the pure helpers**

`moveId` returns a new array with the item moved; returns the same order for out-of-range or equal indices. `playlistArtwork` returns the picked cover first, then the first track with an `artworkUri`, otherwise `{ hue: hueFromSeed(playlist.id + playlist.name) }`.

- [ ] **Step 4: Implement cover storage**

Use `DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true })` so the cover gets a real name, MIME and size from the same fixed picker path. Validate the MIME starts with `image/` and the size is at most 10 MB. Copy `asset.uri` to `Paths.document/playlist-artwork/<playlistId>.<ext>`, where `ext` comes from `extensionForMime(asset.mimeType)` and falls back to the asset name extension. Delete the previous file when replacing. `removePlaylistCover` deletes the stored file and clears the column.

- [ ] **Step 5: Run the tests and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/lib/playlistOrder.ts src/lib/playlistView.ts src/library/playlistArtwork.ts tests/playlistView.test.ts tests/playlistOrder.test.ts
git commit -m "feat(playlists): add cover fallback and order helpers"
```

### Task 9: Redesign the playlist detail and play control

**Files:**
- Create: `src/components/CollectionHeader.tsx`
- Modify: `src/screens/PlaylistsScreen.tsx`, `src/screens/LikedScreen.tsx`
- Test: none (UI; device-verified)

**Interfaces:**
- Produces: `CollectionHeader({ title, description?, meta, artworkUri?, fallbackHue, onPlay, onShuffle?, onEdit? })`.
- The detail screen consumes `playlistArtwork`, `formatDuration`, `queue`, and `SongRow` styling.

- [ ] **Step 1: Build the shared header**

Layout for a phone: 140 px cover on the left, right column with title, optional two-line description, and meta (`N songs · total duration`). Below, one action row: a 52 px accent `Play` pill with the play glyph and label, and a 52 px ghost circular `Shuffle` button. Title uses `type.display`, description `type.meta` with `textDim`, meta `type.meta`. One focal action: Play. Disable both at 0.4 opacity when the queue is empty. Use `tabular-nums` for counts and durations.

- [ ] **Step 2: Replace the detail header and rows**

In `PlaylistsScreen.tsx`, use `CollectionHeader` in place of the current `Play playlist` button. Rows use a 48 px cover, title, artist, duration, and remove button. Do not add a drag handle yet; Task 11 adds it with the drag behavior, so this commit has no dead affordance. Do not show numeric position or up/down chevrons. Align row height, gaps, and text hierarchy with the Library `TrackRow` and the removed Catalog's song lists.

- [ ] **Step 3: Wire play and shuffle**

Play uses the current queue in order. Shuffle starts from a shuffled copy of the queue but does not persist a new playlist order. Use the existing player `setQueue`/`playTrack` path through `onPlay`; add an `onShuffle` callback from `AppShell` if the existing `playQueue` cannot express it.

- [ ] **Step 4: Verify on device**

Empty playlist: both actions disabled, empty copy reads well. One song: shuffle is harmless. Long description wraps to two lines and does not push the actions off-screen on a small device. Play starts the queue at the first row; shuffle starts a different first track.

- [ ] **Step 5: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/components/CollectionHeader.tsx src/screens/PlaylistsScreen.tsx src/screens/LikedScreen.tsx
git commit -m "feat(playlists): redesign detail hero and play control"
```

### Task 10: Edit playlist name, description and cover

**Files:**
- Create: `src/components/PlaylistEditSheet.tsx`
- Modify: `src/screens/PlaylistsScreen.tsx`, `src/AppShell.tsx`
- Test: none (UI; device-verified)

**Interfaces:**
- Produces: `PlaylistEditSheet({ visible, playlist, onClose, onSaved })`.
- Consumes: `updatePlaylistDetails`, `pickPlaylistCover`, `removePlaylistCover`, `playlistArtwork`.

- [ ] **Step 1: Build the sheet**

Use the existing `Sheet` component. Fields: name (required, max 60), description (multiline, max 280, placeholder `What is this playlist for?`), cover preview with `Choose cover` and `Remove`. Show the current effective cover, including the first-track fallback, so the preview never goes blank.

- [ ] **Step 2: Wire it from the index and detail**

Add an edit (pencil) action to each playlist row and to the detail header. Opening it passes the playlist and its current queue for the fallback preview. On save, update local state and the DB; on `onSaved`, refresh the index.

- [ ] **Step 3: Verify on device**

Create a playlist with no cover: the generated cover shows. Add a track with artwork: the detail cover falls back to that artwork. Pick a custom cover: it replaces the fallback in both index and detail. Remove the custom cover: it falls back again. Delete the first track: the fallback moves to the next track or the generated cover. Relaunch and confirm persistence.

- [ ] **Step 4: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/components/PlaylistEditSheet.tsx src/screens/PlaylistsScreen.tsx src/AppShell.tsx
git commit -m "feat(playlists): edit name description and cover"
```

### Task 11: Drag to reorder playlist rows

**Files:**
- Modify: `src/screens/PlaylistsScreen.tsx`
- Test: none (interaction; device-verified)

**Interfaces:**
- Consumes: `react-native-sortables` `Sortable.Grid`, `Sortable.Handle`, `Animated.ScrollView`, `useAnimatedRef`.
- Consumes: `reorderPlaylistTracks`, `moveId`.
- Produces: `const scrollableRef = useAnimatedRef<Animated.ScrollView>()`, passed to both the `Animated.ScrollView` and `Sortable.Grid`. `react-native-sortables` only mounts its auto-scroll provider when `scrollableRef` is set.

- [ ] **Step 1: Replace the detail list**

Use `Animated.ScrollView` with `ref={scrollableRef}` and `Sortable.Grid` inside. Pass `scrollableRef={scrollableRef}` to the grid. `columns={1}`, `rowGap={0}`, `keyExtractor={(track) => track.id}`, `dragActivationDelay={300}`, `customHandle`, `onDragEnd={({ data }) => ...}`. Render `CollectionHeader` inside the same `Animated.ScrollView`, above the grid, so it scrolls with the list; do not pass it as grid data. Confirm the grid renders all rows (Sortables does not virtualize; a playlist is small, but do not use it for a thousands-row list).

- [ ] **Step 2: Make only the handle drag**

Row layout: cover, text, duration, `Sortable.Handle` with the `reorder-three-outline` icon, remove button. The play `Pressable` and remove button must never start a drag. Use `Sortable.Touchable` only if a plain `Pressable` fires during a drag; verify on device.

- [ ] **Step 3: Persist the order**

On drag end, map `data` to ids, set `trackIds` optimistically, then call `reorderPlaylistTracks(selectedId, ids)`. On failure, reload from the DB and show `Could not reorder the playlist.` Do not renumber on every frame; one DB transaction after the drop.

- [ ] **Step 4: Keep screen-reader order changes**

Add `accessibilityActions` to the row: `increment` labelled `Move up`, `decrement` labelled `Move down`. On action, use `moveId` and the same persistence path. This is the accessible fallback, not visible arrows.

- [ ] **Step 5: Verify on device**

Drag the first row to the last and back. Drag with auto-scroll at both edges. Cancel mid-drag by backing out; the row must land and the order must match the screen. Rapidly drag twice; the second drop wins. Kill and relaunch: order persists. Open the playlist as a queue and confirm playback order matches. Test TalkBack move actions.

- [ ] **Step 6: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/screens/PlaylistsScreen.tsx
git commit -m "feat(playlists): drag to reorder rows"
```

---

## Phase 3: Verification and release

### Task 12: Device verification matrix and docs

**Files:**
- Create: `docs/research/v4-device-check.md`
- Modify: `README.md`, `docs/spec.md`

- [ ] **Step 1: Run the matrix on a real Android device**

Record pass/fail with evidence for each: import from Files, Downloads, Drive and SD; import of a 0-byte provider copy; imported file plays after relaunch; rename imported file; rename scanned file or fall back to copy; back from every screen; double-press exit; heart in Now Playing persists; playlist cover pick/remove/fallback; playlist description; drag reorder with auto-scroll and cancel; playlist order persists and matches playback; Catalog tab gone; artwork still appears in Library and Now Playing; migration from 0.3.1.

- [ ] **Step 2: Record failures with logcat**

For anything that fails, capture `adb logcat -b crash` and the relevant normal log slice. Link the trace in the doc. Never record an untested pass.

- [ ] **Step 3: Update the docs**

`README.md`: status, the new v4 scope, Catalog removed, drag reorder, import/tag fixes, dependency stack. `docs/spec.md`: add a v4 section that points discovery to the gated plan and records the removal of Catalog and link import for now.

- [ ] **Step 4: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add docs/research/v4-device-check.md README.md docs/spec.md
git commit -m "docs: record v4 device verification"
```

---

## Acceptance

- Importing an MP3 from any Android provider yields a real filename, a playable file, and embedded tags when present.
- Renaming or editing tags on an imported file succeeds; a scanned file either writes in place or offers the copy fallback, and the original always plays.
- Back closes overlays and routes first; it exits only after a double press at the Library root.
- Now Playing has a heart next to the sleep timer, and it persists to Liked Songs.
- Catalog is gone from the tab bar and routing, and artwork still appears everywhere.
- Playlists show a hero cover, description, modern Play/Shuffle actions, and drag reorder with persisted order.
- The app runs from an upgrade install with the v3 schema migration.
- Every device claim in `v4-device-check.md` has recorded evidence.
