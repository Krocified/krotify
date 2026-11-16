# v5 Player Recovery, Hidden Tracks, and Settings Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make playback survive a deleted or moved file, give hidden and cleared tracks a real page with Clear and Delete, and make Settings tell the truth about permission, scan, hidden tracks, storage, and playback.

**Architecture:** Validate every queue entry before it reaches `AudioPlaylist`. Build the playlist window only from playable entries, and stop plus clear the engine on any load failure so one missing file cannot wedge the next play. Move hidden-track management out of Settings into its own screen backed by `tracks.status`. Settings becomes a state surface over the foundation repo and storage modules, not a set of placeholder rows. Lyrics stays on disk but disappears from the UI behind one constant.

**Tech Stack:** Expo SDK 58, React Native 0.88, TypeScript, `expo-audio` (`AudioPlaylist`), `expo-file-system` (`File`), `expo-media-library`, `expo-sqlite`, Ionicons.

**Spec:** `docs/superpowers/specs/2026-11-16-krotify-v5-file-ownership-design.md`.

**Foundation:** `docs/superpowers/plans/2026-11-16-v5-track-store-and-imports.md`. This plan must be applied after that foundation. It consumes the foundation interfaces exactly; do not fork the repo or reintroduce `src/library/exclusions.ts`.

## Foundation Interfaces

Read the foundation plan first. These are the exact contracts this plan builds on:

```ts
// src/tracks/types.ts
type TrackRecord = {
  id: string;
  source: 'scan' | 'import' | 'download';
  location: string;
  fileName: string;
  sizeBytes?: number;
  durationMs: number;
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  trackNumber?: number;
  discNumber?: number;
  year?: number;
  genre?: string;
  explicit?: boolean;
  artworkUri?: string;
  status: 'active' | 'hidden' | 'removed';
  missing: 0 | 1;
  addedAt: number;
  lastSeenAt: number;
  artworkHue: number;
};
```

```ts
// src/tracks/repo.ts
listActiveTracks(): Promise<TrackRecord[]>;
listHiddenTracks(): Promise<TrackRecord[]>;
listRemovedOwnedTracks(): Promise<TrackRecord[]>;
getTrack(id: string): Promise<TrackRecord | null>;
setTrackStatus(id: string, status: 'active' | 'hidden' | 'removed'): Promise<void>;
setTrackMissing(id: string, missing: boolean): Promise<void>;
deleteTrackRecord(id: string): Promise<void>;
```

```ts
// src/tracks/view.ts
toUiTrack(record: TrackRecord): Track;
```

```ts
// src/storage/types.ts
type StorageRoot = { uri: string; name: string; kind: 'app' | 'picked' };
```

```ts
// src/storage/root.ts
getStorageRoot(): Promise<StorageRoot>;
chooseStorageRoot(): Promise<StorageRoot | null>;
moveOwnedFiles(to: StorageRoot): Promise<{ moved: number; failures: { name: string; reason: string }[] }>;
storageInfo(): Promise<{
  root: StorageRoot;
  fileCount: number;
  totalBytes: number;
  reclaimableBytes: number;
}>;
cleanRemovedOwnedFiles(): Promise<{ deleted: number; bytes: number }>;
deleteOwnedFile(location: string): Promise<void>; // lives in src/storage/store.ts
```

```ts
// src/db/settings.ts
type ScanSummary = {
  lastScanAt: number;
  found: number;
  newTracks: number;
  missing: number;
};
getScanSummary(): Promise<ScanSummary | null>;
putScanSummary(summary: ScanSummary): Promise<void>;
getSetting(key: string): Promise<string | null>;
putSetting(key: string, value: string): Promise<void>;
```

`src/AppShell.tsx` already produces `refreshLibraryFromDb(): Promise<void>`, which reads active and hidden rows through `toUiTrack` and replaces both UI lists. `src/AppShell.tsx` already loads, hides, restores, excludes, and deletes through the track repo. This plan extends those paths rather than replacing them.

The UI uses the foundation's `Track` view. It exposes `uri` from `location`. If `toUiTrack` does not copy `missing`, add that one field in Task 2 because the player and warning UI depend on it. `isMissingTrack` accepts `0`, `1`, `true` and `false` so the UI is insulated from the exact flag shape.

`listActiveTracks` excludes `hidden` and `removed` and rows with an empty location. `listHiddenTracks` returns `status = 'hidden'`. `listRemovedOwnedTracks` returns `status = 'removed'` owned rows for reclaimable space.

## Out of Scope

- The tag filter bar, tag create/assign/unassign.
- Recently played card size and rail cap.
- The Import tab redesign and the local import list.
- Link import through ytmp3.ge.
- Replacing the foundation's scan, import, or storage implementation.
- iOS work. Android-first development build.

## Global Constraints

- Android first. A development build is required. Expo Go cannot prove playback, MediaStore, SAF folder, or permission behavior.
- Local playback works with no network and no account.
- Clear never deletes a file. Delete always confirms and names the track first.
- Never claim a device pass without running it on a device and recording the result.
- No new runtime dependency unless `npx expo install` resolves the SDK-compatible version.
- No comments unless they explain a non-obvious decision. Conventional Commits. No push without an explicit instruction.
- Every task ends with `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`.
- Icons are Ionicon names. UI copy uses no em dash.

## Review Focus

1. **Stuck engine:** a load, append, or playlist failure must call `engine.stop()`, clear the window refs, and invalidate in-flight generation so the next play starts clean. No path may leave a stale `WindowState`.
2. **Missing target:** a dead target must set a friendly error, mark `missing = 1`, show the warning UI, and never call `engine.load` with a broken playlist.
3. **Hidden Clear vs Delete:** Clear sets `status = 'removed'` for every source and keeps the row plus the file. Delete removes the row and the file after naming the track. A rescan must not revive a cleared scan track.
4. **Settings truthfulness:** every row reflects real state. No "Granted" until read, no scan result until written, no exclude-all at zero without a reason, no storage size that is guessed.
5. **Back behavior:** Hidden tracks closes to Settings first. Settings closes to the screen that opened it. No new route exits on the first back press.

---

## File Map

| File | Responsibility |
|---|---|
| `src/lib/playbackRecovery.ts` | Pure playable-window filtering and next-playable selection |
| `tests/playbackRecovery.test.ts` | Window filtering and next-playable tests |
| `src/library/playbackSource.ts` | Playback URI resolution and `MissingFileError` |
| `src/player/PlayerProvider.tsx` | Validate entries, drop dead entries, recover engine, advance to playable |
| `src/player/audioEngine.ts` | Keep `stop()` clearing the native playlist and global indexes |
| `src/tracks/actions.ts` | Clear a track and delete a record plus file |
| `src/components/TrackRow.tsx` | Missing-file badge and accessible warning |
| `src/components/TrackActionsSheet.tsx` | Missing warning and Clear/Delete file actions |
| `src/screens/NowPlayingScreen.tsx` | Missing warning, Clear/Delete CTAs, next-playable action, lyrics gate |
| `src/screens/LibraryScreen.tsx` | No structural change; rows inherit `TrackRow` warning |
| `src/screens/HiddenTracksScreen.tsx` | Full-screen hidden tracks page |
| `src/screens/SettingsScreen.tsx` | Library, Storage, Playback, About sections |
| `src/lib/backIntent.ts` | Hidden tracks back action |
| `tests/backIntent.test.ts` | Hidden page back resolver coverage |
| `src/lib/settingsView.ts` | Pure permission, scan, count, byte and missing helpers |
| `tests/settingsView.test.ts` | Settings helper tests |
| `src/library/permissions.ts` | Read and request audio permission state |
| `src/tracks/view.ts` | Copy `missing` into the UI `Track` if the foundation does not |
| `src/types.ts` | UI `Track.missing` and the `hiddenTracks` screen name |
| `src/lib/features.ts` | `LYRICS_ENABLED` flag |
| `tests/features.test.ts` | Lyrics flag guard |
| `src/AppShell.tsx` | Hidden page routing, missing actions, storage state, settings wiring |
| `docs/research/v5-player-hidden-settings-check.md` | Recorded device matrix |

---

## Phase 1: Playback Recovery

### Task 1: Add pure playable-window helpers

**Files:**
- Create: `src/lib/playbackRecovery.ts`, `tests/playbackRecovery.test.ts`

**Interfaces:**
- Produces: `buildPlayableWindow(entries: WindowEntry[], targetGlobal: number): PlayableWindow`.
- Produces: `nextPlayableIndex(length: number, from: number, playable: ReadonlySet<number>, wrap?: boolean): number`.
- `WindowEntry = { global: number; uri: string | null }`.
- `PlayableWindow = { playable: Array<{ global: number; uri: string }>; localIndex: number; missingGlobals: number[] }`.
- `localIndex` is `-1` when the target is dead.
- `nextPlayableIndex` starts after `from`, scans forward, and wraps only when `wrap` is true.

- [ ] **Step 1: Write the failing tests**

Create `tests/playbackRecovery.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayableWindow, nextPlayableIndex } from '../src/lib/playbackRecovery.ts';

test('buildPlayableWindow drops dead entries and reindexes the target', () => {
  const result = buildPlayableWindow(
    [
      { global: 4, uri: 'file:///a.mp3' },
      { global: 5, uri: null },
      { global: 6, uri: 'file:///c.mp3' },
    ],
    6,
  );
  assert.deepEqual(result.playable, [
    { global: 4, uri: 'file:///a.mp3' },
    { global: 6, uri: 'file:///c.mp3' },
  ]);
  assert.equal(result.localIndex, 1);
  assert.deepEqual(result.missingGlobals, [5]);
});

test('buildPlayableWindow reports a dead target with no local index', () => {
  const result = buildPlayableWindow(
    [
      { global: 0, uri: 'file:///a.mp3' },
      { global: 1, uri: null },
    ],
    1,
  );
  assert.equal(result.localIndex, -1);
  assert.deepEqual(result.missingGlobals, [1]);
});

test('nextPlayableIndex skips dead entries forward', () => {
  assert.equal(nextPlayableIndex(6, 1, new Set([0, 4, 5])), 4);
});

test('nextPlayableIndex wraps only when asked', () => {
  assert.equal(nextPlayableIndex(6, 4, new Set([0])), -1);
  assert.equal(nextPlayableIndex(6, 4, new Set([0]), true), 0);
});

test('nextPlayableIndex returns minus one when nothing is playable', () => {
  assert.equal(nextPlayableIndex(3, 0, new Set(), true), -1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/playbackRecovery.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the helpers**

`buildPlayableWindow` keeps entries with a non-empty `uri`, preserves the input order, returns the index of `targetGlobal` in the filtered list, and lists every dead global. `nextPlayableIndex` treats `from < 0` as `-1` and starts at `from + 1`; when `wrap` is true it also scans `0` through `from`; it returns `-1` when no candidate is playable.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/playbackRecovery.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/lib/playbackRecovery.ts tests/playbackRecovery.test.ts
git commit -m "feat(player): add playable window helpers"
```

### Task 2: Recover from missing files in the player

**Files:**
- Create: `src/library/playbackSource.ts`
- Modify: `src/player/PlayerProvider.tsx`, `src/player/audioEngine.ts`, `src/tracks/view.ts`, `src/types.ts`

**Interfaces:**
- Produces: `MissingFileError`, `isMissingFileError(error)`, `resolvePlaybackUri(track: Track, assets: Map<string, Asset>): Promise<string>`.
- Changes: `PlayerContextValue` adds `advanceToNextPlayable: () => Promise<boolean>`.
- Changes: `loadWindow` resolves every window entry, drops dead entries with `buildPlayableWindow`, marks `setTrackMissing(id, true)` for missing entries, and never calls `engine.load` when the target is dead.
- Changes: a dead target sets `lastError = 'File missing'`, keeps the target in `track` with `missing: 1`, calls `resetAudioWindow()`, and returns `false`.
- Changes: every load, append, restore, and playlist-path throw calls `resetAudioWindow()`.
- Produces internally: `resetAudioWindow()` calls `engine.stop()`, clears `windowRef`, clears `loadedQueueRef`, clears `appendingRef`, and increments `loadGenerationRef`.
- Changes: UI `Track` adds `missing: 0 | 1`; `toUiTrack` copies `record.missing` when the foundation does not already do so.
- Consumes: `setTrackMissing` from `src/tracks/repo.ts`.

- [ ] **Step 1: Expose the missing flag on the UI track**

Check `toUiTrack` in `src/tracks/view.ts`. If it does not already copy `missing` and `src/types.ts` does not already declare it, add `missing: 0 | 1` to `Track` and `missing: record.missing` to the adapter. No screen reads `TrackRecord` directly.

- [ ] **Step 2: Add the missing-file source resolver**

Create `src/library/playbackSource.ts`. Use `File` from `expo-file-system` and `Asset` from `expo-media-library`.

```ts
export class MissingFileError extends Error {
  constructor(readonly trackId: string) {
    super('File missing');
    this.name = 'MissingFileError';
  }
}

export function isMissingFileError(error: unknown): error is MissingFileError {
  return error instanceof MissingFileError;
}

export async function resolvePlaybackUri(
  track: Track,
  assets: Map<string, Asset>,
): Promise<string> {
  if (track.source === 'scan') {
    const asset = assets.get(track.id);
    const uri = track.uri || (asset ? await asset.getUri() : '');
    if (!uri) throw new MissingFileError(track.id);
    if (uri.startsWith('content://')) return uri;
    if (!new File(uri).exists) throw new MissingFileError(track.id);
    return uri;
  }
  if (!track.uri || !new File(track.uri).exists) throw new MissingFileError(track.id);
  return track.uri;
}
```

If the foundation already provides a resolver with this behavior, import it instead and keep the `MissingFileError` contract. Do not add a second file-existence policy.

- [ ] **Step 3: Add `resetAudioWindow` and recover every load path**

In `src/player/PlayerProvider.tsx`:

```ts
const resetAudioWindow = useCallback(() => {
  loadGenerationRef.current += 1;
  engine.stop();
  windowRef.current = { globalIndexes: [] };
  loadedQueueRef.current = null;
  appendingRef.current = false;
}, []);
```

Wrap `engine.load`, `engine.append`, `engine.playlist.play()`, and `engine.playlist.seekTo` paths so a throw calls `resetAudioWindow()` and sets a short error. A failed seek may keep the loaded target; a failed load or append must stop and clear.

- [ ] **Step 4: Resolve and filter the window**

Replace the `entries` block in `loadWindow` with one resolution per window index:

```ts
const resolved = await Promise.all(
  indexes.map(async (global) => {
    const item = nextQueue[global];
    if (!item) return { global, uri: null, missing: false } as const;
    try {
      return { global, uri: await resolveUri(item), missing: false } as const;
    } catch (error) {
      return { global, uri: null, missing: isMissingFileError(error) } as const;
    }
  }),
);
if (generation !== loadGenerationRef.current) return false;

const window = buildPlayableWindow(
  resolved.map(({ global, uri }) => ({ global, uri })),
  targetIndex,
);
for (const entry of resolved) {
  if (entry.missing) void setTrackMissing(nextQueue[entry.global].id, true).catch(() => {});
}
```

If `window.localIndex < 0`, set `lastError` to `'File missing'`, set `track` to `{ ...currentTrack, missing: 1 }`, set `queue` and `index`, call `resetAudioWindow()`, and return `false`. Do not call `engine.load`.

When the target is playable, call `engine.load` with only `window.playable`, `window.localIndex`, and the matching global indexes.

- [ ] **Step 5: Add the advance-to-next-playable path**

Add `advanceToNextPlayable` to the provider. Starting from `indexRef.current`, walk the queue circularly, resolve each candidate, skip and mark missing entries, and call `loadWindow` for the first playable candidate. When no candidate resolves, set `lastError = 'No playable tracks'` and return `false`. Add `indexRef` synced to `index`, and add the method to `PlayerContextValue` and the `useMemo` dependency list.

- [ ] **Step 6: Verify on device**

Build and install the dev client. Delete the file behind the currently playing track while the app is closed, relaunch, and try to play a different track. Then delete the file behind the track the user taps. In both cases: the warning appears, no broken playlist loads, and the next play works. Record the exact result.

- [ ] **Step 7: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/library/playbackSource.ts src/player/PlayerProvider.tsx src/player/audioEngine.ts src/tracks/view.ts src/types.ts
git commit -m "fix(player): recover from missing files"
```

---

## Phase 2: Missing-File UI

### Task 3: Warn on missing files with Clear and Delete

**Files:**
- Create: `src/tracks/actions.ts`, `src/lib/settingsView.ts`
- Modify: `src/components/TrackRow.tsx`, `src/components/TrackActionsSheet.tsx`, `src/screens/NowPlayingScreen.tsx`, `src/AppShell.tsx`

**Interfaces:**
- Produces: `isMissingTrack(track)` in `src/lib/settingsView.ts`.
- Produces in `src/tracks/actions.ts`:
  - `clearTrack(id: string): Promise<void>` calls `setTrackStatus(id, 'removed')`.
  - `deleteTrackEverywhere(track: Track, assets: Map<string, Asset>): Promise<void>` deletes the scan asset when present, otherwise calls `deleteOwnedFile(track.uri)`, then calls `deleteTrackRecord(track.id)`. If the file delete fails for a reason other than "not found", keep the row and throw.
- Changes: `TrackRow` shows an `alert-circle-outline` icon and `File missing` under the artist when `isMissingTrack(track)` is true. The accessibility label ends with `, file missing`.
- Changes: `TrackActionsSheet` accepts `missing?: boolean`, `onClear?: (track) => void`, `onDeleteFile?: (track) => void`. When missing, it shows a `File missing` row and exactly two destructive paths: `Delete from library` and `Delete file`. It does not show edit, rename, hide, or the old device delete.
- Changes: `NowPlayingScreen` accepts `onClearTrack`, `onDeleteFile`. When the current track is missing it shows a warning block above the transport with `Delete from library`, `Delete file`, and `Play next available`.
- Changes: `AppShell` owns two `ConfirmSheet` flows. Clear names the track and says the audio file stays. Delete names the track and says the file will be deleted.
- Consumes: `clearTrack`, `deleteTrackEverywhere`, `isMissingTrack`.

- [ ] **Step 1: Add the shared missing helper**

In `src/lib/settingsView.ts`, add:

```ts
export function isMissingTrack(track: { missing?: 0 | 1 | boolean }): boolean {
  return track.missing === 1 || track.missing === true;
}
```

This is the only place the UI interprets the foundation flag. Add `isMissingTrack accepts both flag shapes` to `tests/settingsView.test.ts` when that file is created in Task 5. For now, create the helper in this task and let Task 5 add the test.

- [ ] **Step 2: Add the track actions**

Create `src/tracks/actions.ts` with `clearTrack` and `deleteTrackEverywhere`. For a scan track, call `asset.delete()` when the asset exists; if it returns `false`, throw. For owned tracks, call `deleteOwnedFile(track.uri)` from `src/storage/store.ts`, then delete the record. Never delete the file on Clear.

- [ ] **Step 3: Show the warning in rows and the action sheet**

In `TrackRow.tsx`, keep the 72 px row height. Replace the artist line with `File missing` when missing; keep the artist otherwise. In `TrackActionsSheet.tsx`, build the missing action list before the regular list and use the exact labels `Delete from library` and `Delete file`.

- [ ] **Step 4: Add the Now Playing warning and CTAs**

In `NowPlayingScreen.tsx`, render the warning only when `isMissingTrack(track)`. Use a surface card with the warning icon, the title `File missing`, and the hint `This track's audio file is missing or moved.` Buttons call `onClearTrack(track)`, `onDeleteFile(track)`, and `advanceToNextPlayable()`. Keep the existing `lastError` line.

- [ ] **Step 5: Wire AppShell**

Add `clearTarget` and `deleteTarget` states. Pass `onClear` and `onDeleteFile` to the action sheet and Now Playing. Confirm sheets:

- Clear title: `Remove from library?`; message: `"${title}" will be removed from the library. The audio file stays on this device.`; confirm: `Remove`.
- Delete title: `Delete file?`; message: `"${title}" and its audio file will be deleted from this device. This cannot be undone.`; confirm: `Delete file`.

After either action, update `libraryTracks` by removing the row, call `removeFromQueue([id])`, stop if it is the current track, and clear any status note. Mirror `lastError === 'File missing'` into the Library status note so a failed tap explains itself.

- [ ] **Step 6: Verify on device**

Delete the file behind a Library row while the app is closed, launch, and tap the row. Confirm the row and Now Playing show the warning. Tap `Delete from library`: the row disappears, the file remains in the folder. Tap `Delete file` on another missing track: the confirm names it, the file is gone, and the row is gone. Tap `Play next available` when another playable track follows: it plays.

- [ ] **Step 7: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/tracks/actions.ts src/lib/settingsView.ts src/components/TrackRow.tsx src/components/TrackActionsSheet.tsx src/screens/NowPlayingScreen.tsx src/AppShell.tsx
git commit -m "feat(library): warn on missing files"
```

---

## Phase 3: Hidden Tracks

### Task 4: Add the hidden tracks page and back behavior

**Files:**
- Create: `src/screens/HiddenTracksScreen.tsx`
- Modify: `src/types.ts`, `src/lib/backIntent.ts`, `tests/backIntent.test.ts`, `src/screens/SettingsScreen.tsx`, `src/AppShell.tsx`

**Interfaces:**
- Changes: `ScreenName` adds `'hiddenTracks'`.
- Changes: `BackAction` adds `'close-hidden-tracks'`.
- Changes: `resolveBack` returns `'close-hidden-tracks'` when `state.screen === 'hiddenTracks'`, before Settings and Search.
- Produces: `HiddenTracksScreen({ visible, tracks, onBack, onRestore, onRestoreAll, onClear, onDelete })`.
- Changes: `SettingsScreen` accepts `hiddenCount: number` and `onOpenHiddenTracks: () => void` and renders a row whose title is `Hidden tracks, N`.
- Changes: `AppShell` routes the page and handles Restore, Restore all, Clear, and Delete. It reuses the foundation's hidden list and `refreshLibraryFromDb()`.
- Consumes: `setTrackStatus`, `listHiddenTracks`, `refreshLibraryFromDb`, `clearTrack`, `deleteTrackEverywhere`.

- [ ] **Step 1: Write the failing resolver test**

Add to `tests/backIntent.test.ts`:

```ts
test('closes the hidden tracks page before Settings', () => {
  assert.equal(resolveBack(state({ screen: 'hiddenTracks' })), 'close-hidden-tracks');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/backIntent.test.ts`
Expected: FAIL because `hiddenTracks` and `close-hidden-tracks` do not exist.

- [ ] **Step 3: Add the screen name and back action**

Add `'hiddenTracks'` to `ScreenName` and `'close-hidden-tracks'` to `BackAction`. Insert the hidden case in `resolveBack` after Now Playing and before Settings. Return `'close-hidden-tracks'`.

- [ ] **Step 4: Build the full-screen page**

Create `src/screens/HiddenTracksScreen.tsx` using the same absolute root, slide animation, `BackPill`, `Animated.ScrollView`, and `ScrollBar` pattern as `SettingsScreen`. The page has:

- Header title `Hidden tracks`.
- A `Restore all` row when `tracks.length > 0`.
- One row per hidden track with 56 px cover, title, artist, a `File missing` badge when `isMissingTrack(track)`, and three text actions: `Restore`, `Clear`, `Delete`. `Delete` uses the danger color.
- Empty state: `No hidden tracks. Tracks you hide from the library appear here.`
- No tab bar padding, because the page hides the tab bar.

- [ ] **Step 5: Wire AppShell and Settings**

Use the hidden list that the foundation's `refreshLibraryFromDb()` already replaces. If `AppShell` does not keep it in state, add `hiddenTracks` fed by `listHiddenTracks()`. Add `openHiddenTracks()` setting `screen` to `'hiddenTracks'`, `closeHiddenTracks()` setting it back to `'settings'`, and a `close-hidden-tracks` case in the back handler. Exclude `hiddenTracks` from `showTabBar`.

Restore calls `setTrackStatus(id, 'active')` then `refreshLibraryFromDb()`. Restore all loops over the current hidden ids in chunks, sets each active, then calls `refreshLibraryFromDb()`. Clear and Delete reuse the Task 3 confirm sheets and actions, then call `refreshLibraryFromDb()`.

In `SettingsScreen`, add the `Hidden tracks, N` row above Exclude all, with `hiddenCount` from the hidden list. Keep the rest of the screen unchanged in this task; Task 6 rebuilds it.

- [ ] **Step 6: Verify on device**

Open Settings, tap `Hidden tracks, N`, and confirm back returns to Settings, not Library. Restore one track and confirm it returns to the Library. Clear one track, confirm it leaves Hidden tracks, the file stays, and a rescan does not bring it back. Delete one track, confirm the file is gone. Empty the page and confirm the empty state.

- [ ] **Step 7: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/screens/HiddenTracksScreen.tsx src/types.ts src/lib/backIntent.ts tests/backIntent.test.ts src/screens/SettingsScreen.tsx src/AppShell.tsx
git commit -m "feat(library): add hidden tracks page"
```

---

## Phase 4: Settings

### Task 5: Add settings view helpers

**Files:**
- Create or extend: `src/lib/settingsView.ts`, `tests/settingsView.test.ts`

**Interfaces:**
- Produces in `src/lib/settingsView.ts`:
  - `PermissionState = 'granted' | 'denied' | 'not-asked'`.
  - `permissionStateFromResponse({ granted, status }): PermissionState`.
  - `permissionLabel(state): 'Granted' | 'Not granted' | 'Not asked'`.
  - `isMissingTrack(track)` (created in Task 3).
  - `scanResultLabel(found, added, missing): string`.
  - `excludeAllMeta(count): string`.
  - `formatBytes(bytes): string`.
  - `hiddenTracksLabel(count): string`.
  - `moveFilesLabel(fileCount, bytes): string`.
  - `reclaimableLabel(bytes): string`.
  - `StorageView = { folderName: string; fileCount: number; totalBytes: number; reclaimableBytes: number }`.
- Consumes: `ScanSummary` from `src/db/settings.ts` where `newTracks` is the "new" count.

- [ ] **Step 1: Write the failing helper tests**

Create or extend `tests/settingsView.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  excludeAllMeta,
  formatBytes,
  hiddenTracksLabel,
  isMissingTrack,
  moveFilesLabel,
  permissionLabel,
  permissionStateFromResponse,
  reclaimableLabel,
  scanResultLabel,
} from '../src/lib/settingsView.ts';

test('permissionStateFromResponse maps granted undetermined and denied', () => {
  assert.equal(permissionStateFromResponse({ granted: true, status: 'granted' }), 'granted');
  assert.equal(permissionStateFromResponse({ granted: false, status: 'undetermined' }), 'not-asked');
  assert.equal(permissionStateFromResponse({ granted: false, status: 'denied' }), 'denied');
});

test('permissionLabel maps every permission state', () => {
  assert.equal(permissionLabel('granted'), 'Granted');
  assert.equal(permissionLabel('denied'), 'Not granted');
  assert.equal(permissionLabel('not-asked'), 'Not asked');
});

test('isMissingTrack accepts both flag shapes', () => {
  assert.equal(isMissingTrack({ missing: 1 }), true);
  assert.equal(isMissingTrack({ missing: true }), true);
  assert.equal(isMissingTrack({ missing: 0 }), false);
  assert.equal(isMissingTrack({}), false);
});

test('scanResultLabel reports found new and missing counts', () => {
  assert.equal(scanResultLabel(128, 3, 2), '128 tracks, 3 new, 2 missing');
});

test('excludeAllMeta gives a reason at zero', () => {
  assert.equal(excludeAllMeta(0), 'No scanned tracks to exclude');
  assert.equal(excludeAllMeta(4), '4 scanned tracks');
});

test('formatBytes uses readable binary units', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(1024 * 1024), '1.0 MB');
});

test('hiddenTracksLabel keeps the count beside the row title', () => {
  assert.equal(hiddenTracksLabel(0), 'Hidden tracks, 0');
  assert.equal(hiddenTracksLabel(3), 'Hidden tracks, 3');
});

test('moveFilesLabel and reclaimableLabel report files and space', () => {
  assert.equal(moveFilesLabel(2, 2048), 'Move 2 files (2.0 KB)');
  assert.equal(reclaimableLabel(2048), '2.0 KB reclaimable');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/settingsView.test.ts`
Expected: FAIL because the helpers do not exist.

- [ ] **Step 3: Implement the helpers**

`permissionStateFromResponse` returns `granted` when `granted`, `not-asked` when `status === 'undetermined'`, otherwise `denied`. `formatBytes` uses binary units and one decimal place above bytes. `scanResultLabel` returns the exact copy `N tracks, M new, K missing`; callers pass `newTracks` from the foundation summary. `excludeAllMeta(0)` returns `No scanned tracks to exclude`; otherwise `${count} scanned tracks`. `moveFilesLabel` and `reclaimableLabel` use `formatBytes`. `StorageView` mirrors the foundation's `storageInfo` fields without inventing a reclaimable file count.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/settingsView.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/lib/settingsView.ts tests/settingsView.test.ts
git commit -m "feat(settings): add view helpers"
```

### Task 6: Rebuild Settings for Library, Storage, Playback and About

**Files:**
- Create: `src/library/permissions.ts`
- Modify: `src/screens/SettingsScreen.tsx`, `src/AppShell.tsx`

**Interfaces:**
- Produces in `src/library/permissions.ts`:
  - `readAudioPermissionState(): Promise<PermissionState>` using `getPermissionsAsync(false, ['audio'])` and `permissionStateFromResponse`.
  - `grantAudioPermission(): Promise<PermissionState>`: returns `granted` if already granted; requests while `canAskAgain`; otherwise opens `Linking.openSettings()` and returns the current state.
- Changes: `SettingsScreen` props become:

```ts
type Props = {
  visible: boolean;
  status: LibraryStatus;
  scanEnabled: boolean;
  permission: PermissionState | null;
  scanSummary: ScanSummary | null;
  hiddenCount: number;
  scanExcludeCount: number;
  storage: StorageView | null;
  storageBusy: boolean;
  onBack: () => void;
  onToggleScan: (enabled: boolean) => void;
  onGrant: () => void;
  onRescan: () => void;
  onOpenHiddenTracks: () => void;
  onExcludeAll: () => void;
  onChangeFolder: () => void;
  onMoveFiles: () => void;
  onCleanStorage: () => void;
};
```

- Changes: `AppShell` owns `permission`, `scanSummary`, `storage`, and `storageBusy` state, plus the confirm sheets for changing folders, moving files, and cleaning reclaimable files.
- Consumes: `getScanSummary()` from `src/db/settings.ts`; the foundation's `syncScanResults` already writes it after every rescan.
- Consumes: `storageInfo()`, `getStorageRoot()`, `chooseStorageRoot()`, `moveOwnedFiles(to)`, and `cleanRemovedOwnedFiles()` from `src/storage/root.ts`.

- [ ] **Step 1: Add the permission module**

Create `src/library/permissions.ts` as described. `grantAudioPermission` must never throw to the screen; return the last known state on failure.

- [ ] **Step 2: Replace the Settings sections**

In `src/screens/SettingsScreen.tsx`:

- **Library**
  - Permission row: `Permission` with value `Granted`, `Not granted`, `Not asked`, or `Checking`. Show a `Grant` action when the state is not granted.
  - `Scan this device` switch, disabled while `status === 'scanning'`.
  - `Rescan device audio`: enabled only when `scanEnabled` and not scanning. Show `ActivityIndicator` while scanning. Meta shows `scanResultLabel(...)` when a summary exists, otherwise `No scan yet`. Disable reason when scanning is off: `Turn on scanning to rescan.`
  - `Hidden tracks, N` row calling `onOpenHiddenTracks`.
  - `Exclude all scanned tracks`: meta is `excludeAllMeta(scanExcludeCount)`. Disabled at zero with the zero reason as meta. Keep the confirmation in `AppShell`.
- **Storage**
  - Current folder row with `storage.folderName` or `Loading storage...`.
  - `Change folder` calling `onChangeFolder`.
  - `Move existing files`: meta `moveFilesLabel(storage.fileCount, storage.totalBytes)`. Disabled when `fileCount === 0` or `storageBusy`; reason `No files to move.`
  - `Reclaimable space`: meta `reclaimableLabel(storage.reclaimableBytes)`. `Clean` disabled when `reclaimableBytes === 0` or while busy; reason `Nothing to clean.`
- **Playback:** keep the existing sleep timer card unchanged.
- **About:** keep `Krotify {appJson.expo.version}` and the `Release ABI` value.
- Remove the Lyrics section, the Editing section, the duplicate bottom permission row, and the old hidden tracks list.

- [ ] **Step 3: Wire AppShell state and actions**

- Read permission on mount, when Settings opens, and when `AppState` returns to `active`.
- Read `getScanSummary()` when Settings opens. Pass it through unchanged; `SettingsScreen` maps `newTracks` to the "new" position in `scanResultLabel`.
- Read `storageInfo()` when Settings opens and after any storage action. Map it to `StorageView`:

```ts
const toStorageView = (info: Awaited<ReturnType<typeof storageInfo>>): StorageView => ({
  folderName: info.root.name,
  fileCount: info.fileCount,
  totalBytes: info.totalBytes,
  reclaimableBytes: info.reclaimableBytes,
});
```

- `handleRescan` increments `scanId`. Do not compute or write a scan summary here; `syncScanResults` writes it during the scan.
- `handleChangeFolder` calls `chooseStorageRoot()`. If a root is returned, store it as `pendingRootRef`, refresh storage, and when the previous `fileCount > 0`, open a confirm sheet: title `Move files to the new folder?`, message `Move N files (X) now. You can also leave them where they are.`, confirm `Move files`.
- `handleMoveFiles(root?: StorageRoot)` calls `moveOwnedFiles(root ?? await getStorageRoot())`, refreshes storage and `refreshLibraryFromDb()`, and shows a status note with `moved` and `failures.length`.
- `handleCleanStorage` calls `cleanRemovedOwnedFiles()`, refreshes storage, and reports `deleted` files and `bytes`.
- Cleaning and moving are destructive to files; use `ConfirmSheet` and name the count and size. Move and Clean both disable while `storageBusy` is true.

- [ ] **Step 4: Verify on device**

For each row: deny permission and confirm `Not granted` plus a Grant action; grant and confirm `Granted`. Turn scanning off and confirm Rescan is disabled with its reason. Rescan and confirm the spinner, then the exact `N tracks, M new, K missing` result and last scan time. Exclude all and confirm the exact count; empty the count and confirm the disabled reason. Change the folder, cancel, then change again and move: files play afterwards. Clear an owned track, confirm the reclaimable size, run Clean, and confirm it returns to zero. Confirm the Lyrics and Editing sections are absent.

- [ ] **Step 5: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/library/permissions.ts src/screens/SettingsScreen.tsx src/AppShell.tsx
git commit -m "feat(settings): rebuild library storage and about"
```

---

## Phase 5: Lyrics Gate

### Task 7: Hide lyrics behind a constant

**Files:**
- Create: `src/lib/features.ts`, `tests/features.test.ts`
- Modify: `src/screens/NowPlayingScreen.tsx`

**Interfaces:**
- Produces: `LYRICS_ENABLED = false`.
- Changes: Now Playing renders the lyrics toggle only when `LYRICS_ENABLED` is true.
- Changes: `useLyrics` receives `LYRICS_ENABLED && lyricsMode`; the lyrics stage, crossfade, and lyrics note are inert while the flag is false.
- Keeps: `src/components/LyricsPanel.tsx`, `src/library/useLyrics.ts`, `src/library/lyrics.ts`, `src/library/lrclib.ts`, `src/library/lyricsPrefs.ts`, and their tests.

- [ ] **Step 1: Write the failing guard test**

Create `tests/features.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LYRICS_ENABLED } from '../src/lib/features.ts';

test('lyrics UI stays hidden for v5', () => {
  assert.equal(LYRICS_ENABLED, false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/features.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add the flag and gate Now Playing**

Create `src/lib/features.ts` with `export const LYRICS_ENABLED = false;`. In `NowPlayingScreen.tsx`, import the flag, gate the lyrics button, and pass `LYRICS_ENABLED && lyricsMode` to `useLyrics`. Guard the lyrics-mode effect with `if (!LYRICS_ENABLED) return;`. Keep the component tree and files, but the mode can never be entered.

- [ ] **Step 4: Verify on device**

Open Now Playing: there is no lyrics icon, no lyrics mode, and no lyrics error note. Open Settings: there is no Lyrics section. The audio stage and transport are unaffected.

- [ ] **Step 5: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/lib/features.ts tests/features.test.ts src/screens/NowPlayingScreen.tsx
git commit -m "feat(lyrics): hide lyrics ui behind flag"
```

---

## Phase 6: Verification

### Task 8: Record the device matrix

**Files:**
- Create: `docs/research/v5-player-hidden-settings-check.md`

- [ ] **Step 1: Run the matrix on a real Android device**

Record pass/fail with evidence for each:

- Delete a file behind a Library row, relaunch, play another track: no wedge, warning appears.
- Tap a missing track: warning, `Delete from library`, `Delete file`, `Play next available`.
- Delete from library: row gone, file still in the folder.
- Delete file: confirm names the track, file gone, row gone.
- Play next available: plays the next playable track or reports no playable tracks.
- Hidden tracks: open from Settings, back returns to Settings.
- Hidden tracks: Restore, Restore all, Clear, Delete, empty state.
- Clear a hidden scan track, rescan: it does not return.
- Settings permission: Granted, Not granted, Not asked, Grant.
- Settings rescan: spinner, exact result, last scan time.
- Settings hidden row count matches the page.
- Settings exclude all: exact count, disabled at zero with reason.
- Settings storage: folder name, change folder, move files, sizes, Clean.
- Settings playback: sleep timer still works.
- Now Playing: no lyrics toggle.
- Settings: no Lyrics or Editing sections.

- [ ] **Step 2: Record failures with logcat**

For anything that fails, capture `adb logcat -b crash` and the relevant normal log slice. Link the trace in the doc. Never record an untested pass.

- [ ] **Step 3: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add docs/research/v5-player-hidden-settings-check.md
git commit -m "docs: record v5 player and settings checks"
```

No push.

---

## Acceptance

- Deleting or moving a file never wedges playback. The dead target shows `File missing`, the broken playlist is never loaded, and the next play works.
- The playable window contains only resolved entries, and every load, append, or restore failure stops and clears the engine.
- Missing Library rows, Now Playing, and the action sheet show a warning with `Delete from library` and `Delete file`. Confirm sheets name the track.
- Hidden tracks is a full-screen page opened from `Hidden tracks, N`. Restore, Restore all, Clear, Delete, empty state, and missing badges work.
- Clear keeps the row and file for every source. Delete removes both. A rescan does not revive a cleared scan track.
- Settings shows real permission state with Grant, a working scan toggle, a rescan with spinner and `N tracks, M new, K missing`, a hidden count, and an exact exclude-all count with a zero reason.
- Storage shows the current folder, change, move with count and size, and reclaimable space with Clean.
- Playback keeps the sleep timer, About shows version and ABI, and the Lyrics and Editing sections are gone.
- Now Playing has no lyrics control. Lyrics files and tests remain on disk and pass.
- `npm test`, `npx tsc --noEmit`, `npx expo lint`, and `npx expo export --platform web` pass.
- Device claims in `v5-player-hidden-settings-check.md` have recorded evidence.

## Unresolved Risks

- **Foundation coupling:** this plan consumes `storageInfo`, `moveOwnedFiles`, `cleanRemovedOwnedFiles`, `getScanSummary`, `setTrackMissing`, and `toUiTrack` exactly as the foundation plan names them. If the foundation changes those shapes, adapt the call sites and keep the behavior.
- **SAF file operations:** `File.exists`, `deleteOwnedFile`, and `moveOwnedFiles` must be proven for the folder the user actually picks. A SAF root that cannot be resolved to a filesystem path can still fail delete or move.
- **Scan tracks while scanning is off:** playback for previously resolved scan rows depends on the stored location or a rebuilt asset map. If the foundation drops scan rows without an asset map, resolve from `track.uri` and treat a failed `File.exists` as missing.
- **Native playback errors:** `AudioPlaylistStatus` has no error field. This plan handles resolution, load, append, and seek failures. A silent mid-playback native failure may still require a status heuristic later.
- **Clear tombstone size:** reclaimable space is only accurate if `listRemovedOwnedTracks` returns `sizeBytes` for removed owned rows.
- **Restore all volume:** restoring or clearing thousands of hidden rows one `setTrackStatus` at a time needs chunking or the UI will stall.
