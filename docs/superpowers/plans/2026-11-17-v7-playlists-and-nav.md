# v7 Playlists and Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Playlists revamp (cover grid, prominent create, per-card menu, counts) and make the tab bar blur the page actually on top, not the Library underneath.

**Architecture:** A pure `resolveBlurLayer` picks the top visible layer; AppShell owns one `BlurTargetView` ref per layer and passes the matching ref to the existing `TabBar.blurTarget` prop. Playlists gain a summary query (count plus first active artwork) and a presentational card; create, edit and delete keep the existing repo and sheet flows. Requiring the Collections control in the Library header keeps Liked Songs and Playlists reachable while the Library body is only songs and tags.

**Tech Stack:** Expo SDK 58, React Native 0.88, `expo-blur` (`BlurTargetView`), `react-native-sortables`, `expo-sqlite`, existing `Sheet`, `CoverArt`, `ConfirmSheet`.

**Spec:** `docs/spec.md` §v7 “Playlists revamp”, “Active-page navbar blur” and “Library is the song list”.

**Prerequisite:** `docs/superpowers/plans/2026-11-17-v7-ux-and-library-polish.md` Task 1 removes the Library rails; this plan adds the Collections control that keeps Playlists and Liked reachable. The square cropper is `2026-11-17-v7-artwork.md`; this plan only adds the cropper hand-off on playlist covers.

## Global Constraints

- No schema change. Counts and fallback art come from a read query.
- Playlists remain a layered overlay while the active tab stays Library/Import. Do not add a tab.
- The tab bar stays hidden only on Now Playing.
- One blur target at a time, chosen by visual stacking, never by back precedence.
- Every task ends with `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`.
- One conventional commit per task. No push.

## Review Focus

- Opening Settings over Search over the Library must blur Search, then Settings, never the Library.
- Closing a layer must restore the target of the layer below it without a stale ref.
- A playlist with missing tracks must count only active tracks and still show fallback art.
- Creating a playlist from the grid must appear without a reload and with a `0 songs` count.
- Deleting from the overflow menu must not open the playlist first.

---

### Task 1: Visual layer resolver

**Files:**
- Create: `src/lib/layerTarget.ts`
- Test: `tests/layerTarget.test.ts`

**Interfaces:**
- Produces:
  - `export type BlurLayer = 'details' | 'liked' | 'playlists' | 'hidden' | 'settings' | 'search' | 'base'`
  - `export type LayerState = { details: boolean; liked: boolean; playlists: boolean; hidden: boolean; settings: boolean; search: boolean }`
  - `export function resolveBlurLayer(state: LayerState): BlurLayer`

- [ ] **Step 1: Write the failing test**

`tests/layerTarget.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBlurLayer } from '../src/lib/layerTarget.ts';

const none = {
  details: false,
  liked: false,
  playlists: false,
  hidden: false,
  settings: false,
  search: false,
};

test('defaults to the base screen', () => {
  assert.equal(resolveBlurLayer(none), 'base');
});

test('visual stacking wins over open order', () => {
  assert.equal(
    resolveBlurLayer({ ...none, search: true, hidden: true, settings: true }),
    'hidden',
  );
  assert.equal(
    resolveBlurLayer({ ...none, search: true, playlists: true, liked: true }),
    'liked',
  );
  assert.equal(
    resolveBlurLayer({ ...none, liked: true, details: true }),
    'details',
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/layerTarget.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the resolver**

Order: `details`, `liked`, `playlists`, `hidden`, `settings`, `search`, `base`. Return the first true flag.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/layerTarget.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/layerTarget.ts tests/layerTarget.test.ts
git commit -m "feat(ui): resolve the top visible layer for blur"
```

---

### Task 2: One blur target per layer

**Files:**
- Modify: `src/AppShell.tsx:136, 923-1055`
- Modify: `src/screens/SettingsScreen.tsx:144-149`
- Modify: `src/screens/HiddenTracksScreen.tsx:59-72`
- Modify: `src/screens/SearchScreen.tsx:73-85`
- Modify: `src/screens/PlaylistsScreen.tsx:455-479`
- Modify: `src/screens/LikedScreen.tsx:52-55`
- Modify: `src/screens/EditTrackScreen.tsx:312-315`

**Interfaces:**
- Consumes: `resolveBlurLayer` from Task 1.
- Produces: one `ComponentRef<typeof View>` ref per layer in AppShell.

- [ ] **Step 1: Add the refs**

In AppShell, keep the existing base ref and add `searchBlurRef`, `settingsBlurRef`, `hiddenBlurRef`, `playlistsBlurRef`, `likedBlurRef`, `detailsBlurRef`.

- [ ] **Step 2: Wrap each layer root**

Replace each overlay wrapper `View` with `BlurTargetView`:

- Search, Settings and Hidden are always mounted; wrap their existing roots where v7 already provides a layer wrapper.
- Playlists, Liked and Details are conditional; wrap the `styles.overlay` container.

Keep absolute positioning. A `BlurTargetView` is a plain `View` on non-Android platforms, so layout does not change.

- [ ] **Step 3: Resolve and pass the ref**

```ts
const layer = resolveBlurLayer({
  details: editTarget !== null,
  liked: likedOpen,
  playlists: playlistsOpen,
  hidden: screen === 'hiddenTracks',
  settings: screen === 'settings' || screen === 'hiddenTracks',
  search: screen === 'search',
});
const blurTarget = {
  details: detailsBlurRef,
  liked: likedBlurRef,
  playlists: playlistsBlurRef,
  hidden: hiddenBlurRef,
  settings: settingsBlurRef,
  search: searchBlurRef,
  base: blurTargetRef,
}[layer];
```

Pass `blurTarget` to `TabBar` instead of the base ref. Now Playing needs no target because `showTabBar` is false.

- [ ] **Step 4: Verify the regression**

Run the web export and inspect on Android: open Settings over Library; the tab bar must blur the Settings surface. Open Hidden over Settings; the target follows Hidden. Close both; Library returns.

- [ ] **Step 5: Commit**

```bash
git add src/AppShell.tsx src/screens/SettingsScreen.tsx src/screens/HiddenTracksScreen.tsx src/screens/SearchScreen.tsx src/screens/PlaylistsScreen.tsx src/screens/LikedScreen.tsx src/screens/EditTrackScreen.tsx
git commit -m "fix(ui): blur the active layer behind the tab bar"
```

---

### Task 3: Playlist summaries

**Files:**
- Modify: `src/db/repo.ts:56-82`
- Test: `tests/playlistSummaries.test.ts`

**Interfaces:**
- Produces:
  - `export type PlaylistSummary = Playlist & { trackCount: number; firstArtworkUri?: string }`
  - `export async function listPlaylistSummaries(): Promise<PlaylistSummary[]>`

- [ ] **Step 1: Write the failing SQL test**

Use `node:sqlite` like `tests/tracks.test.ts`. Create `playlists`, `playlist_tracks` and `tracks` (only `id`, `status`, `artworkUri` needed), insert two playlists, one with an active track that has art, one with a missing track, and run `PLAYLIST_SUMMARIES_SQL`.

```ts
assert.equal(rows.length, 2);
assert.equal(rows.find((r) => r.id === 'p1')?.trackCount, 1);
assert.equal(rows.find((r) => r.id === 'p1')?.firstArtworkUri, 'file:///a.jpg');
assert.equal(rows.find((r) => r.id === 'p2')?.trackCount, 0);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/playlistSummaries.test.ts`
Expected: FAIL — `PLAYLIST_SUMMARIES_SQL` is not exported.

- [ ] **Step 3: Add the query and repo function**

Export `PLAYLIST_SUMMARIES_SQL` from `src/db/repo.ts`:

```sql
SELECT p.id AS id, p.name AS name, p.createdAt AS createdAt,
       p.description AS description, p.artworkUri AS artworkUri,
       COUNT(t.id) AS trackCount,
       (SELECT t2.artworkUri
          FROM playlist_tracks x
          JOIN tracks t2 ON t2.id = x.trackId
         WHERE x.playlistId = p.id
           AND t2.status = 'active'
           AND t2.artworkUri IS NOT NULL
         ORDER BY x.position ASC
         LIMIT 1) AS firstArtworkUri
  FROM playlists p
  LEFT JOIN playlist_tracks pt ON pt.playlistId = p.id
  LEFT JOIN tracks t ON t.id = pt.trackId AND t.status = 'active'
 GROUP BY p.id
 ORDER BY p.createdAt DESC
```

`listPlaylistSummaries` maps rows with `trackCount: Number(row.trackCount || 0)` and `firstArtworkUri: row.firstArtworkUri ?? undefined`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/playlistSummaries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/repo.ts tests/playlistSummaries.test.ts
git commit -m "feat(playlists): list counts and fallback art"
```

---

### Task 4: Collections entry in the Library header

**Files:**
- Create: `src/components/CollectionsSheet.tsx`
- Modify: `src/components/ScreenHeader.tsx:16-45`
- Modify: `src/screens/LibraryScreen.tsx:79-91`
- Modify: `src/AppShell.tsx` (Library props)

**Interfaces:**
- Produces: `CollectionsSheet({ visible, onClose, onOpenLiked, onOpenPlaylists })`.
- `HeaderActions` gains `onOpenCollections?: () => void`.

- [ ] **Step 1: Build the sheet**

Reuse `Sheet`. Two rows: `Liked Songs` (heart icon, `N songs`) and `Playlists` (musical notes, no count). Selecting a row closes the sheet and calls the handler. When `onOpenLiked` is absent, hide that row.

- [ ] **Step 2: Add the header button**

Render a `library-outline` icon before Search, labeled `Collections`. Add it only when `onOpenCollections` is supplied.

- [ ] **Step 3: Wire AppShell**

Library gets `onOpenCollections={() => setCollectionsOpen(true)}`. The sheet calls the existing `setLikedOpen(true)` and `openPlaylists()` handlers. Close the sheet first.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx expo lint`
Expected: PASS. On web, Collections opens, Liked opens, Playlists opens from the sheet.

- [ ] **Step 5: Commit**

```bash
git add src/components/CollectionsSheet.tsx src/components/ScreenHeader.tsx src/screens/LibraryScreen.tsx src/AppShell.tsx
git commit -m "feat(library): keep collections reachable from the header"
```

---

### Task 5: Playlist grid

**Files:**
- Create: `src/components/PlaylistCard.tsx`
- Create: `src/components/PlaylistActionsSheet.tsx`
- Create: `src/components/PlaylistCreateSheet.tsx`
- Modify: `src/screens/PlaylistsScreen.tsx:39-361`

**Interfaces:**
- `PlaylistCard({ summary, onOpen, onMenu }: { summary: PlaylistSummary; onOpen: () => void; onMenu: () => void })`
- `PlaylistActionsSheet({ visible, playlist, onClose, onEdit, onDelete })`
- `PlaylistCreateSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (playlist: Playlist) => void })`

- [ ] **Step 1: Build the card**

Square `CoverArt` (`width: '100%'`, aspect ratio 1) using `summary.artworkUri ?? summary.firstArtworkUri` and `hueFromSeed(summary.id + summary.name)`. Below it: name (one line) and `N songs` (or `0 songs`). The overflow `ellipsis-horizontal` button is a separate 44x44 pressable that does not open the playlist.

- [ ] **Step 2: Build the actions sheet**

Rows: `Edit` and `Delete` with icons. Delete opens the existing `ConfirmSheet` path; do not duplicate the confirmation logic.

- [ ] **Step 3: Build the create sheet**

One `TextInput` (max 60), `Cancel` and `Create`. `Create` trims, rejects empty inline, calls `createPlaylist(name)`, then `onCreated`. Show a spinner while saving.

- [ ] **Step 4: Replace the index**

Load `listPlaylistSummaries()` instead of `listPlaylists()` for the index. Render a prominent `New playlist` button, then a two-column `FlatList` of `PlaylistCard`. Keep the existing empty state copy. On create, prepend the new summary with `trackCount: 0`. On delete, reuse `confirmDelete` and remove it.

Keep detail unchanged in this task so the old edit pencil stays reachable until the new menu is verified.

- [ ] **Step 5: Run the gates**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/PlaylistCard.tsx src/components/PlaylistActionsSheet.tsx src/components/PlaylistCreateSheet.tsx src/screens/PlaylistsScreen.tsx
git commit -m "feat(playlists): switch the index to a cover grid"
```

---

### Task 6: Detail polish and cropper hand-off

**Files:**
- Modify: `src/screens/PlaylistsScreen.tsx:363-453`
- Modify: `src/components/PlaylistEditSheet.tsx:98-120`

**Interfaces:**
- Consumes: `SquareImageCropper` and `stagePlaylistCoverFrom` from the artwork plan.

- [ ] **Step 1: Refresh the summary after edits**

After `PlaylistEditSheet.onSaved` and after reorder, update the matching index summary (name, cover, count) so the grid is correct when the user goes back.

- [ ] **Step 2: Add the cropper**

In `PlaylistEditSheet`, replace the direct `stagePlaylistCover` call with pick → `SquareImageCropper` → `stagePlaylistCoverFrom`. The existing commit and remove paths stay unchanged.

- [ ] **Step 3: Keep the chrome**

Confirm the detail keeps `CollectionHeader` (Play, Shuffle, pencil), the persistent tab bar/mini-player, and the `Sortable.Grid` reorder with accessibility Move up/down.

- [ ] **Step 4: Run the gates**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/PlaylistsScreen.tsx src/components/PlaylistEditSheet.tsx
git commit -m "feat(playlists): refresh grid summaries and crop covers"
```

---

### Task 7: Device check

- [ ] Verify the tab bar blur on Library, Import, Search, Settings, Hidden, Playlists, Liked and Details.
- [ ] Create, rename, cover-crop, play, shuffle, reorder and delete a playlist.
- [ ] Verify counts update after adding and removing tracks, and that missing tracks are not counted.
- [ ] Verify the Collections sheet is the only entry to Liked and Playlists from the Library.
- [ ] Record the evidence in `docs/research/v7-device-check.md`.

## Acceptance

- The tab bar blurs the top visible layer, including Settings and Hidden.
- The Playlists index is a two-column cover grid with a prominent Create, counts, per-card edit/delete and an empty state.
- Detail keeps the hero, cover edit, Play, Shuffle, reorder and persistent chrome.
- Liked Songs and Playlists remain reachable from the Library header.
- No schema migration and no new dependency.
