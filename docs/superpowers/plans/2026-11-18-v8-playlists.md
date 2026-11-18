# v8 Playlists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quiet the playlist card menu and let a playlist be filled from inside it, with a full-screen picker that supports search, tag filtering and select all.

**Architecture:** A new full-screen `PlaylistSongPicker` lists the library with the existing search and tag helpers, marks already-added tracks as disabled, and confirms through a `SelectionBar`. `PlaylistsScreen` owns the picker, appends through `addPlaylistTracks` from plan 1, and refreshes its counts and fallback art. The card overflow loses its filled circle.

**Tech Stack:** React Native 0.88, Expo SDK 58, `expo-sqlite`, `node --test`.

**Spec:** `docs/spec.md` §v8 — "A quiet playlist menu", "Build a playlist from the library"; §Screens & flows Playlists.

## Global Constraints

- No new dependencies.
- Never write to an audio file.
- The picker is a screen inside the Playlists layer, not a new tab and not a modal sheet.
- Back and Cancel leave the playlist unchanged.
- Every pressable has `accessibilityRole` and `accessibilityLabel`; checked/disabled rows expose `accessibilityState`.
- Before a task is done: `npm test`, `npx tsc --noEmit`, `npx expo lint` pass.
- Conventional Commits, imperative, under 50 characters, no AI attribution.

## Review Focus

- A track already in the playlist must be visibly added and unselectable, not silently appended twice.
- A search or tag filter must not change what Select all selects outside the visible set.
- Adding while the playlist is empty must also refresh the card's fallback cover and count.
- Back with zero selected must close the picker, and back with rows selected must clear the selection first.
- A failed append must leave the picker open with the previous selection and a named failure.

---

### Task 1: Quiet card menu and disabled rows

**Files:**
- Modify: `src/components/PlaylistCard.tsx`
- Modify: `src/components/TrackRow.tsx`

**Interfaces:**
- Produces: `TrackRow` props `disabled?: boolean`; `PlaylistCard` markup unchanged.

- [ ] **Step 1: Quiet the card overflow**

In `PlaylistCard`, change the menu ionicon size from 20 to 18, remove `backgroundColor` and `borderRadius` from `styles.menu`, and keep the 44×44 layout so the hit target does not shrink. Use `colors.textDim` by default and `colors.text` while pressed (add a pressed color rule if needed). No filled circle in any state.

- [ ] **Step 2: Add the disabled row state**

In `TrackRow`, add `disabled?: boolean` defaulting to `false`. When `disabled` is true: the main pressable is `disabled`, `accessibilityState` includes `{ disabled: true, selected: true }`, the trailing glyph is `checkmark-circle` in `colors.textDim`, and the title and meta render at 45% opacity. Do not change the row's height.

- [ ] **Step 3: Run checks and a smoke test**

Run: `npx tsc --noEmit && npx expo lint`
Expected: PASS. Web: the playlist grid shows a small bare ellipsis over the cover corner; pressing it still opens the actions sheet.

- [ ] **Step 4: Commit**

```bash
git add src/components/PlaylistCard.tsx src/components/TrackRow.tsx
git commit -m "fix(playlists): quiet the card menu"
```

---

### Task 2: Picker filtering

**Files:**
- Create: `src/lib/playlistPicker.ts`
- Test: `tests/playlistPicker.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function pickerTracks(input: {
    tracks: readonly Track[];
    query: string;
    tagId: string | null;
    assignments: ReadonlyMap<string, readonly string[]>;
  }): Track[];
  export function pickerSelectableIds(
    tracks: readonly Track[],
    existingIds: readonly string[],
  ): string[];
  ```

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { pickerSelectableIds, pickerTracks } from '../src/lib/playlistPicker.ts';
import type { Track } from '../src/types.ts';

const track = (id: string, title: string, artist = ''): Track => ({
  id, uri: `file:///${id}.mp3`, source: 'scan', missing: 0,
  title, artist, album: '', durationMs: 1000, artworkHue: 0,
});

test('filters by search and tag together', () => {
  const tracks = [track('a', 'Blue Sky', 'Mira'), track('b', 'Red Sky', 'Kite')];
  const assignments = new Map([['a', ['t1']], ['b', ['t2']]]);
  assert.deepEqual(
    pickerTracks({ tracks, query: 'blue', tagId: null, assignments }).map((t) => t.id),
    ['a'],
  );
  assert.deepEqual(
    pickerTracks({ tracks, query: '', tagId: 't2', assignments }).map((t) => t.id),
    ['b'],
  );
  assert.deepEqual(pickerTracks({ tracks, query: '', tagId: null, assignments }).length, 2);
});

test('existing ids are not selectable and preserve order', () => {
  const tracks = [track('a', 'A'), track('b', 'B'), track('c', 'C')];
  assert.deepEqual(pickerSelectableIds(tracks, ['b']), ['a', 'c']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/playlistPicker.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`pickerTracks` applies `searchTracks(tracks as Track[], query)` then `filterTracksByTag(result, tagId, assignments)`. `pickerSelectableIds` filters out ids present in `existingIds` (build a `Set` first) and keeps input order.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/playlistPicker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/playlistPicker.ts tests/playlistPicker.test.ts
git commit -m "feat(playlists): add picker filtering helpers"
```

---

### Task 3: Add songs screen

**Files:**
- Create: `src/screens/PlaylistSongPicker.tsx`

**Interfaces:**
- Consumes: Task 2 helpers; `SelectionBar`, `SelectionBar` props from plan 1 Task 2; `TrackRow` disabled state from Task 1; `TagFilterBar`, `searchTracks`.
- Produces:
  ```ts
  type Props = {
    playlistName: string;
    tracks: Track[];
    existingIds: readonly string[];
    tags: TagCount[];
    assignments: ReadonlyMap<string, readonly string[]>;
    onClose: () => void;
    onAdd: (trackIds: string[]) => Promise<void>;
    registerBackInterceptor?: (handler: (() => boolean) | null) => void;
  };
  ```

- [ ] **Step 1: Build the screen shell**

The screen mounts only while the picker is open, so it is an absolutely positioned full-bleed `View` (same pattern as the other layers) with no `visible` prop. Header: `BackPill` labelled `Back to playlist`, title `Add songs`, and the playlist name as a dim subtitle. Below: a `TextInput` with placeholder `Search songs`, `autoCorrect={false}`, `returnKeyType="search"`; a `TagFilterBar`; and the list.

- [ ] **Step 2: Compute the visible list**

```ts
const [query, setQuery] = useState('');
const [tagId, setTagId] = useState<string | null>(null);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const existing = useMemo(() => new Set(existingIds), [existingIds]);
const visible = useMemo(
  () => pickerTracks({ tracks, query, tagId, assignments }),
  [tracks, query, tagId, assignments],
);
const selectableIds = useMemo(
  () => pickerSelectableIds(visible, existingIds),
  [visible, existingIds],
);
```

Initial state is empty; because the screen mounts fresh per open, no reset effect is needed.

- [ ] **Step 3: Render rows and the bar**

Each row is `TrackRow` with `selectionMode`, `selected={selectedIds.has(track.id)}`, `disabled={existing.has(track.id)}`, and `onPress` toggling through `toggleId`. The `SelectionBar` gets `count`, `allState={selectionState(selectedIds, selectableIds)}`, `onToggleAll` through `toggleAllVisible(selectedIds, selectableIds)`, one action `{ key: 'add', label: 'Add N songs', icon: 'add' }` disabled at zero, and `onCancel={onClose}`.

- [ ] **Step 4: Confirm**

On add: `await onAdd([...selectedIds])` preserving the visible order:

```ts
const ordered = visible.map((t) => t.id).filter((id) => selectedIds.has(id));
```

Show a busy state on the action while awaiting; on failure keep the selection and show a `Could not add these songs.` message under the header.

- [ ] **Step 5: Back**

```ts
useEffect(() => {
  if (!registerBackInterceptor) return;
  registerBackInterceptor(() => {
    if (selectedIds.size > 0) { setSelectedIds(new Set()); return true; }
    if (query !== '') { setQuery(''); return true; }
    onClose();
    return true;
  });
  return () => registerBackInterceptor(null);
}, [registerBackInterceptor, selectedIds, query, onClose]);
```

- [ ] **Step 6: Run checks and a web smoke test**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: PASS. Web: search filters the list, a tag pill filters it further, Select all selects only visible selectable rows.

- [ ] **Step 7: Commit**

```bash
git add src/screens/PlaylistSongPicker.tsx
git commit -m "feat(playlists): add songs picker screen"
```

---

### Task 4: Wire Add songs into playlist detail

**Files:**
- Modify: `src/screens/PlaylistsScreen.tsx`
- Modify: `src/AppShell.tsx` (pass tags/assignments/registerBackInterceptor if `PlaylistsScreen` does not already receive them)

**Interfaces:**
- Consumes: Task 3 props; `addPlaylistTracks` and `bulkAddMessage` from plan 1 Task 6.
- Produces: `PlaylistsScreen` prop `pickerOpen` state is internal; no new external API except optional `registerBackInterceptor`.

- [ ] **Step 1: Add the entry points**

In `renderDetail`, add an `Add songs` pressable under the hero (icon `add`, label `Add songs`, accessibility label `Add songs to <name>`). In the empty state, replace the explanatory sentence with the same button and keep the `No songs yet` title.

- [ ] **Step 2: Add the state and the add handler**

```ts
const [pickerOpen, setPickerOpen] = useState(false);

async function addSongs(trackIds: string[]) {
  if (!selectedId) return;
  const added = await addPlaylistTracks(selectedId, trackIds);
  setTrackIds((previous) => [...previous, ...trackIds.filter((id) => !previous.includes(id))]);
  refreshSummaries();
  onPlaylistsChanged?.();
  setPickerOpen(false);
  setMessage(bulkAddMessage(added, 1, []));
}
```

The picker already excludes existing ids, so `added` is normally `trackIds.length`. `bulkAddMessage` is imported from `src/lib/playlistAdd.ts`.

- [ ] **Step 3: Render the picker**

Render `PlaylistSongPicker` inside the detail view (not the index) only when `pickerOpen`, with `playlistName={name}`, `tracks`, `existingIds={trackIds}`, `tags`, `assignments`, `onClose={() => setPickerOpen(false)}`, `onAdd={addSongs}`, and the shell's `registerBackInterceptor`. The picker registers only while it is visible.

- [ ] **Step 4: Pass tags and assignments**

`PlaylistsScreen` currently receives `tracks` only. Add props `tags: TagCount[]` and `assignments: ReadonlyMap<string, readonly string[]>` and pass them from `AppShell` where `PlaylistsScreen` is rendered (`useTags()` already exposes both in the shell).

- [ ] **Step 5: Run checks and a web smoke test**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: PASS. Web: open a playlist, Add songs, pick three, confirm; the rows appear in order, the count and hero fallback update, and reopening the picker shows those three already added.

- [ ] **Step 6: Commit**

```bash
git add src/screens/PlaylistsScreen.tsx src/AppShell.tsx
git commit -m "feat(playlists): add songs from playlist detail"
```

---

### Task 5: Evidence

**Files:**
- Modify: `docs/research/v8-device-checks.md`

- [ ] **Step 1: Record**

Device, Android version, build, date and outcome for: menu hit target, picker with a 2000-track library, tag and search combinations, Select all under a filter, back precedence (selection → query → close), add from the empty state.

- [ ] **Step 2: Commit**

```bash
git add docs/research/v8-device-checks.md
git commit -m "docs: record v8 playlist device checks"
```

---

## Self-Review

- Spec coverage: quiet menu (Task 1), picker with search and tags (Tasks 2–3), select all scoped to visible selectable rows (Tasks 2–3), Add N songs and order (Tasks 3–4), empty-state entry (Task 4).
- Interfaces: `pickerTracks`/`pickerSelectableIds` (Task 2) consumed by Task 3; `addPlaylistTracks`/`bulkAddMessage` are defined in plan 1 Task 6 and only consumed here; `PlaylistSongPicker` props match the render in Task 4.
- Review Focus: already-added rows (Tasks 2–3), filter-scoped select all (Task 2 test + Task 3 allState), fallback cover/count refresh (Task 4 Step 2 `refreshSummaries`), back precedence (Task 3 Step 5), failed append (Task 3 Step 4).
