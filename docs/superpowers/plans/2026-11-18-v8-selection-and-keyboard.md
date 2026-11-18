# v8 Selection and Keyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make multi-select predictable everywhere (one indicator, back exits, select all, bulk tag and playlist actions) and stop any keyboard from covering a text field.

**Architecture:** Selection becomes a small pure module (`src/lib/selection.ts`) consumed by `SelectionBar` and the four selecting screens. Android back goes through the shell's existing `registerBackInterceptor` slot, which already sits before `resolveBack`. Bulk tag writes go through `TagProvider`; bulk playlist writes through `repo.addPlaylistTracks` so the new Add songs picker in plan 4 shares them. The bottom sheet gains a measured keyboard lift in one place.

**Tech Stack:** React Native 0.88, Expo SDK 58, `expo-sqlite`, `node --test` for pure modules.

**Spec:** `docs/spec.md` §v8 — "One selection indicator", "Back exits selection", "Selection actions grow up", "Select all, unselect all", "Sheets stay above the keyboard"; `docs/intent.md` principles "One way back", "Never under the keyboard".

## Global Constraints

- Android-first. A dev build is required; Expo Go cannot verify native behavior.
- Do not edit `android/` by hand. Native config goes in `app.json` and config plugins.
- Never write to an audio file. Tag changes touch SQLite only.
- Every pressable has `accessibilityRole` and `accessibilityLabel`; selected/checked/disabled states use `accessibilityState`.
- No new dependencies in this plan.
- Before a task is done: `npm test`, `npx tsc --noEmit`, `npx expo lint` all pass.
- Conventional Commits, imperative, subject under 50 characters, no AI attribution.
- Web preview must keep rendering; no native-only import at module scope.

## Review Focus

- Select all while a tag filter is active must not select filtered-out rows; unselect all must not clear rows hidden by the filter.
- Back pressed while a sheet is open over a selection must close the sheet, not the selection.
- Deselecting the last track must keep selection mode at "0 selected", not drop the mode.
- A failed bulk tag write must not leave the optimistic UI claiming success.
- A sheet with a long list must keep the focused input and the submit row visible, not just the sheet.

---

### Task 1: Selection model

**Files:**
- Create: `src/lib/selection.ts`
- Test: `tests/selection.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Selection = ReadonlySet<string>`
  - `type SelectionState = 'none' | 'partial' | 'all'`
  - `toggleId(selected: Selection, id: string): Set<string>`
  - `selectVisible(selected: Selection, visibleIds: readonly string[]): Set<string>`
  - `clearSelection(): Set<string>`
  - `selectionState(selected: Selection, visibleIds: readonly string[]): SelectionState`
  - `toggleAllVisible(selected: Selection, visibleIds: readonly string[]): Set<string>`
  - `selectionBackHandler(active: boolean, exit: () => void): (() => boolean) | null`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearSelection,
  selectVisible,
  selectionBackHandler,
  selectionState,
  toggleAllVisible,
  toggleId,
} from '../src/lib/selection.ts';

test('toggleId adds then removes an id and never mutates the input', () => {
  const start = new Set(['a']);
  const added = toggleId(start, 'b');
  assert.deepEqual([...added].sort(), ['a', 'b']);
  assert.deepEqual([...start], ['a']);
  assert.deepEqual([...toggleId(added, 'b')], ['a']);
});

test('selectionState reports none, partial and all over visible ids', () => {
  assert.equal(selectionState(new Set(), ['a', 'b']), 'none');
  assert.equal(selectionState(new Set(['a']), ['a', 'b']), 'partial');
  assert.equal(selectionState(new Set(['a', 'b', 'c']), ['a', 'b']), 'all');
  assert.equal(selectionState(new Set(['z']), ['a', 'b']), 'none');
  assert.equal(selectionState(new Set(['z']), []), 'none');
});

test('selectVisible unions only visible ids', () => {
  const next = selectVisible(new Set(['z']), ['a', 'b']);
  assert.deepEqual([...next].sort(), ['a', 'b', 'z']);
});

test('toggleAllVisible selects every visible id from partial', () => {
  const next = toggleAllVisible(new Set(['a', 'z']), ['a', 'b']);
  assert.deepEqual([...next].sort(), ['a', 'b', 'z']);
});

test('toggleAllVisible clears only visible ids from all', () => {
  const next = toggleAllVisible(new Set(['a', 'b', 'z']), ['a', 'b']);
  assert.deepEqual([...next], ['z']);
});

test('clearSelection returns an empty set', () => {
  assert.equal(clearSelection().size, 0);
});

test('selectionBackHandler is null when inactive and exits when active', () => {
  let exited = 0;
  assert.equal(selectionBackHandler(false, () => { exited += 1; }), null);
  const handler = selectionBackHandler(true, () => { exited += 1; });
  assert.ok(handler);
  assert.equal(handler(), true);
  assert.equal(exited, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/selection.test.ts`
Expected: FAIL with `Cannot find module '../src/lib/selection.ts'`.

- [ ] **Step 3: Implement `src/lib/selection.ts`**

Use `ReadonlySet<string>` inputs and always return a new `Set`. `toggleAllVisible` returns `clearVisible` when the state is `all`, otherwise `selectVisible`. `selectionBackHandler` returns `() => { exit(); return true; }` when `active`, else `null`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/selection.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/selection.ts tests/selection.test.ts
git commit -m "feat(selection): add pure selection model"
```

---

### Task 2: SelectionBar all-control

**Files:**
- Modify: `src/components/SelectionBar.tsx`
- Test: none (component only; verified by typecheck, lint and the web preview in Step 4)

**Interfaces:**
- Consumes: `SelectionState` from Task 1.
- Produces:
  ```ts
  type Props = {
    count: number;
    allState: SelectionState;
    onToggleAll: () => void;
    actions: SelectionAction[];
    onCancel: () => void;
  };
  ```

- [ ] **Step 1: Update the props and render the all-control**

Replace the `count` text as the leading element with a pressable checkbox glyph followed by the count text. Use `Ionicons` `checkbox` for `all`, `remove-circle` for `partial`, `square-outline` for `none`. Label is `Select all` when `partial`/`none`, `Unselect all` when `all`; set `accessibilityRole="checkbox"`, `accessibilityState={{ checked: allState === 'all' ? true : allState === 'partial' ? 'mixed' : false }}`. Keep the 44px minimum touch target. The bar width is fixed; the actions row keeps its horizontal scroll.

- [ ] **Step 2: Adopt the new props at all three call sites in the same commit**

`SelectionBar` has three call sites (`LibraryScreen`, `HiddenTracksScreen`, `TagsScreen`). At each, compute `visibleIds` from the rows it renders (the tag-filtered `tracks`, the hidden `tracks`, the sorted tag ids) and pass:

```ts
allState={selectionState(selectedIds, visibleIds)}
onToggleAll={() => setSelectedIds((previous) => toggleAllVisible(previous, visibleIds))}
```

This keeps the tree type-clean; Tasks 3 and 4 handle the header and back behavior only.

- [ ] **Step 3: Run typecheck and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 4: Web smoke check**

Run: `npx expo start --web`, open the Library, long-press a song.
Expected: the bar shows the checkbox, count, actions and Cancel; pressing the checkbox with nothing selected selects all visible songs.

- [ ] **Step 5: Commit**

```bash
git add src/components/SelectionBar.tsx src/screens/LibraryScreen.tsx src/screens/HiddenTracksScreen.tsx src/screens/TagsScreen.tsx
git commit -m "feat(selection): add select-all control to bar"
```

---

### Task 3: One indicator and back exits selection in Library

**Files:**
- Modify: `src/screens/LibraryScreen.tsx`
- Modify: `src/AppShell.tsx` (pass `registerBackInterceptor` to `LibraryScreen`)
- Test: covered by `tests/selection.test.ts` via `selectionBackHandler`

**Interfaces:**
- Consumes: Task 1 helpers, Task 2 props.
- Produces: `LibraryScreen` prop `registerBackInterceptor?: (handler: (() => boolean) | null) => void`.

- [ ] **Step 1: Keep the header unchanged during selection**

Delete the `selecting ?` branches in `ScreenHeader`: always render the wordmark and `HeaderActions`. Remove the header Cancel pressable and its styles (`selectTitle`, `cancelButton`, `cancelText` if unused). Do not remove the `SelectionBar`.

- [ ] **Step 2: Drive the bar from the selection model**

Replace the local Set logic with `toggleId` and `clearSelection`; `allState` and `onToggleAll` already come from Task 2. `visibleIds` stays the displayed `tracks` array, which the shell has already tag-filtered.

- [ ] **Step 3: Register the back handler while selecting**

```ts
useEffect(() => {
  if (!registerBackInterceptor) return;
  registerBackInterceptor(selectionBackHandler(selecting, exitSelection));
  return () => registerBackInterceptor(null);
}, [registerBackInterceptor, selecting]);
```

Add the prop to `LibraryScreen`'s `Props` and pass `registerBackInterceptor={registerBackInterceptor}` where `AppShell` renders `LibraryScreen`.

- [ ] **Step 4: Run checks**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Web smoke check**

Run: `npx expo start --web`. Long-press a song, then press the browser back (or the Android back on a dev build).
Expected: the header still reads `Krotify`; back clears the selection and the Library stays open.

- [ ] **Step 6: Commit**

```bash
git add src/screens/LibraryScreen.tsx src/AppShell.tsx
git commit -m "feat(library): unify selection and exit on back"
```

---

### Task 4: Hidden tracks and Tags use the same rules

**Files:**
- Modify: `src/screens/HiddenTracksScreen.tsx`
- Modify: `src/screens/TagsScreen.tsx`
- Modify: `src/AppShell.tsx` (pass `registerBackInterceptor` to both)

**Interfaces:**
- Consumes: Task 1, Task 2, Task 3's interceptor prop shape.
- Produces: both screens accept `registerBackInterceptor?: (handler: (() => boolean) | null) => void`.

- [ ] **Step 1: Remove the header count and Cancel from both screens**

The header keeps the back pill and the title (`Hidden tracks` / `Tags`). Remove the `selecting ?` title swap and the trailing Cancel. The `Select` entry action stays when not selecting. Do not change the existing actions (Restore/Clear/Delete, Delete).

- [ ] **Step 2: Adopt the selection model and clear on hide**

Use Task 1's helpers. Add:

```ts
useEffect(() => {
  if (visible) return;
  setSelecting(false);
  setSelectedIds(clearSelection());
}, [visible]);
```

so leaving the layer never leaves a stale selection. Wire `allState`/`onToggleAll` over the visible rows (`tracks` for Hidden tracks, `sorted` ids for Tags).

- [ ] **Step 3: Register back**

Same effect as Task 3 for both screens. `AppShell` passes `registerBackInterceptor` to `HiddenTracksScreen` and `TagsScreen`.

- [ ] **Step 4: Run checks and smoke test**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: PASS. In the web preview, select tags, press back: selection clears, the Tags page stays open.

- [ ] **Step 5: Commit**

```bash
git add src/screens/HiddenTracksScreen.tsx src/screens/TagsScreen.tsx src/AppShell.tsx
git commit -m "feat(selection): unify hidden and tags selection"
```

---

### Task 5: Bulk tags

**Files:**
- Modify: `src/tags/queries.ts` (export `BULK_ASSIGN_SQL`)
- Modify: `src/tags/repo.ts` (`assignTagToTracks`, `unassignTagFromTracks`)
- Modify: `src/tags/filter.ts` (`tagCoverage`)
- Modify: `src/tags/TagProvider.tsx` (`assignMany`, `unassignMany`, `createAndAssignMany`)
- Create: `src/components/TagBulkSheet.tsx`
- Test: `tests/tagBulk.test.ts`

**Interfaces:**
- Consumes: `SelectionState` from Task 1.
- Produces:
  ```ts
  // src/tags/filter.ts
  export function tagCoverage(
    assignments: ReadonlyMap<string, readonly string[]>,
    trackIds: readonly string[],
    tagId: string,
  ): SelectionState;

  // src/tags/repo.ts
  export async function assignTagToTracks(trackIds: readonly string[], tagId: string): Promise<void>;
  export async function unassignTagFromTracks(trackIds: readonly string[], tagId: string): Promise<void>;

  // TagProvider
  assignMany(trackIds: readonly string[], tagId: string): Promise<void>;
  unassignMany(trackIds: readonly string[], tagId: string): Promise<void>;
  createAndAssignMany(trackIds: readonly string[], name: string): Promise<Tag | null>;

  // src/components/TagBulkSheet.tsx
  type Props = { visible: boolean; trackIds: readonly string[]; onClose: () => void; onDone: (message: string) => void };
  ```

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { tagCoverage } from '../src/tags/filter.ts';

test('tagCoverage is none, partial and all over the selected tracks', () => {
  const assignments = new Map([
    ['a', ['x']],
    ['b', ['x', 'y']],
  ]);
  assert.equal(tagCoverage(assignments, ['a', 'b'], 'x'), 'all');
  assert.equal(tagCoverage(assignments, ['a', 'b'], 'y'), 'partial');
  assert.equal(tagCoverage(assignments, ['a', 'b'], 'z'), 'none');
  assert.equal(tagCoverage(assignments, [], 'x'), 'none');
});

test('BULK_ASSIGN_SQL is an insert-or-ignore against track_tags', () => {
  const source = readFileSync(new URL('../src/tags/queries.ts', import.meta.url), 'utf8');
  assert.match(source, /INSERT OR IGNORE INTO track_tags/);
});
```
Place the SQL test in `tests/tagDb.test.ts` next to the existing schema tests if that reads better; either file is acceptable.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/tagBulk.test.ts`
Expected: FAIL — `tagCoverage` is not exported.

- [ ] **Step 3: Implement the pure helper and repo functions**

`tagCoverage` counts tracks whose assignment list includes `tagId`; reuse `selectionState` from Task 1 by building a Set of covered ids. In `queries.ts` add:

```sql
export const BULK_ASSIGN_SQL =
  'INSERT OR IGNORE INTO track_tags (trackId, tagId) VALUES (?, ?)';
```

`assignTagToTracks` opens `db.withTransactionAsync` and runs `BULK_ASSIGN_SQL` per id; `unassignTagFromTracks` runs the existing delete per id in one transaction.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/tagBulk.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the provider and the sheet**

In `TagProvider`, add optimistic multi-track mutation: for `assignMany` set every track id in `applyOptimistic` (loop over ids inside one `setState`), write, then `refresh()`; on throw, `refresh()` and rethrow. `createAndAssignMany` creates the tag then calls `assignMany`.

`TagBulkSheet` is a `Sheet` (title `Tags`) listing every tag with `tagCoverage` states (`checkbox`, `remove-circle`, `square-outline`) and a New tag input. Each press calls `assignMany` or `unassignMany` and refreshes state; the sheet does not close. It reports one message through `onDone` on close: `Tagged N tracks` / `Removed from N tracks`. Disable rows while writing.

- [ ] **Step 6: Wire it into the Library selection bar**

Add a `Tag` action (`pricetags-outline`) to `LibraryScreen`'s actions, opening `TagBulkSheet` with `[...selectedIds]`; on finish show a `Toast` through the shell. Pass `onBulkTag` up to `AppShell` if the toast lives there, or keep a local message. The selection stays active until the user cancels.

- [ ] **Step 7: Run checks and smoke test**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: PASS. Web: select three songs, Tag → pick a tag → all three show the tag in the filter bar; deselect all and tag again to unassign.

- [ ] **Step 8: Commit**

```bash
git add src/tags src/components/TagBulkSheet.tsx src/screens/LibraryScreen.tsx
git commit -m "feat(tags): bulk assign from selection"
```

---

### Task 6: Bulk Add to playlist

**Files:**
- Create: `src/lib/playlistAdd.ts`
- Modify: `src/db/repo.ts` (`addPlaylistTracks`)
- Modify: `src/components/TrackActionsSheet.tsx` (`PlaylistPickerSheet` takes `tracks`)
- Modify: `src/AppShell.tsx`, `src/screens/NowPlayingScreen.tsx` (call sites)
- Modify: `src/screens/LibraryScreen.tsx` (action + sheet)
- Test: `tests/playlistAdd.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/lib/playlistAdd.ts
  export type AddTarget = { playlistId: string; name: string };
  export function tracksToAppend(
    existingIds: readonly string[],
    selectedIds: readonly string[],
  ): string[];
  export function appendPositions(maxPosition: number, count: number): number[];
  export function bulkAddMessage(
    added: number,
    playlistCount: number,
    failures: readonly string[],
  ): string;

  // src/db/repo.ts
  export async function addPlaylistTracks(
    playlistId: string,
    trackIds: readonly string[],
  ): Promise<number>;

  // PlaylistPickerSheet
  type PickerProps = {
    visible: boolean;
    tracks: Track[];
    onClose: () => void;
    onAdded?: (playlist: Playlist) => void;
  };
  ```

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendPositions,
  bulkAddMessage,
  tracksToAppend,
} from '../src/lib/playlistAdd.ts';

test('tracksToAppend drops existing and duplicate ids and keeps order', () => {
  assert.deepEqual(tracksToAppend(['a'], ['b', 'a', 'b', 'c']), ['b', 'c']);
  assert.deepEqual(tracksToAppend([], ['z', 'y']), ['z', 'y']);
});

test('appendPositions continues the gap-numbered sequence', () => {
  assert.deepEqual(appendPositions(0, 2), [1000, 2000]);
  assert.deepEqual(appendPositions(4000, 1), [5000]);
  assert.deepEqual(appendPositions(0, 0), []);
});

test('bulkAddMessage counts tracks, playlists and failures', () => {
  assert.equal(bulkAddMessage(3, 2, []), 'Added 3 songs to 2 playlists');
  assert.equal(bulkAddMessage(1, 1, []), 'Added 1 song to 1 playlist');
  assert.equal(bulkAddMessage(2, 2, ['Roadtrip']), 'Added 2 songs to 1 playlist. Failed: Roadtrip');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/playlistAdd.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the helpers and `addPlaylistTracks`**

`addPlaylistTracks` reads the current `MAX(position)` (0 when empty), appends with `appendPositions`, and inserts inside one transaction with `INSERT OR IGNORE`; return the number of ids passed that were not already present (compute from a prior `listPlaylistTracks` read inside the same call). Keep `addPlaylistTrack` as a one-id wrapper.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/playlistAdd.test.ts`
Expected: PASS.

- [ ] **Step 5: Generalize the picker**

Replace `track: Track | null` with `tracks: Track[]`. For every checked playlist, read the existing ids, compute `tracksToAppend`, call `addPlaylistTracks`, and collect successes/failures. New playlist creation adds every track through `addPlaylistTracks`. Final message uses `bulkAddMessage`. Update the two call sites to pass `[track]`.

- [ ] **Step 6: Add the Library action**

Add a `Playlist` action (`bookmark-outline`) opening `PlaylistPickerSheet` with the selected tracks; disable at zero. On added, clear the selection, hide the bar, and show `bulkAddMessage` through the existing toast.

- [ ] **Step 7: Run checks and smoke test**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: PASS. Web: select two songs, add them to two playlists, confirm both counts increase and the toast reads `Added 2 songs to 2 playlists`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/playlistAdd.ts src/db/repo.ts src/components/TrackActionsSheet.tsx src/AppShell.tsx src/screens/NowPlayingScreen.tsx src/screens/LibraryScreen.tsx tests/playlistAdd.test.ts
git commit -m "feat(playlists): bulk add selected tracks"
```

---

### Task 7: Sheets stay above the keyboard

**Files:**
- Create: `src/lib/sheetKeyboard.ts`
- Create: `src/components/useKeyboardHeight.ts`
- Modify: `src/components/Sheet.tsx`
- Test: `tests/sheetKeyboard.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/lib/sheetKeyboard.ts
  export function sheetKeyboardMetrics(input: {
    keyboardHeight: number;
    bottomInset: number;
    viewportHeight: number;
  }): { lift: number; maxHeight: number };

  // useKeyboardHeight.ts
  export function useKeyboardHeight(): number;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { sheetKeyboardMetrics } from '../src/lib/sheetKeyboard.ts';

test('no keyboard means no lift and the 88% cap', () => {
  const metrics = sheetKeyboardMetrics({ keyboardHeight: 0, bottomInset: 24, viewportHeight: 1000 });
  assert.equal(metrics.lift, 0);
  assert.equal(metrics.maxHeight, 880);
});

test('lift subtracts the bottom inset the panel already pads', () => {
  const metrics = sheetKeyboardMetrics({ keyboardHeight: 320, bottomInset: 24, viewportHeight: 1000 });
  assert.equal(metrics.lift, 296);
  assert.equal(metrics.maxHeight, 608);
});

test('maxHeight has a floor and never exceeds the viewport', () => {
  assert.equal(
    sheetKeyboardMetrics({ keyboardHeight: 500, bottomInset: 0, viewportHeight: 400 }).maxHeight,
    240,
  );
  assert.equal(
    sheetKeyboardMetrics({ keyboardHeight: 0, bottomInset: 0, viewportHeight: 0 }).maxHeight,
    240,
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/sheetKeyboard.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the metrics**

`lift = Math.max(0, keyboardHeight - bottomInset)`. `maxHeight = Math.max(240, Math.min(viewportHeight * 0.88, viewportHeight - lift - 40))`, so the 40 is the gap below the top inset.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/sheetKeyboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in `Sheet`**

`useKeyboardHeight` subscribes to `keyboardDidShow`/`keyboardDidHide` (and `keyboardWillShow`/`keyboardWillHide` on iOS) and returns the height, cleaning up on unmount. In `Sheet`, compute `sheetKeyboardMetrics` with `useWindowDimensions().height` and `insets.bottom`, set `maxHeight` and `marginBottom: lift` on the panel, and keep the internal `ScrollView` scrollable. Do not wrap in `KeyboardAvoidingView`; inside a `Modal` on Android it does not resize the window.

- [ ] **Step 6: Run checks and smoke test**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: PASS. On a dev build open Playlists → New playlist, focus the name field: the field and the Create button stay above the keyboard. Repeat for Paste lyrics and Edit playlist.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sheetKeyboard.ts src/components/useKeyboardHeight.ts src/components/Sheet.tsx tests/sheetKeyboard.test.ts
git commit -m "fix(sheets): lift above the keyboard"
```

---

### Task 8: Text-field sweep

**Files:**
- Modify: `src/screens/ImportScreen.tsx` (wrap the scrolling content so the link field and Download action stay visible)
- Verify only: `src/screens/EditTrackScreen.tsx`, `src/screens/SettingsScreen.tsx`, `src/screens/TagsScreen.tsx`, `src/screens/SearchScreen.tsx`, `src/components/TagPicker.tsx`, `src/components/PlaylistCreateSheet.tsx`, `src/components/PlaylistEditSheet.tsx`, `src/components/PasteLyricsSheet.tsx`

**Interfaces:**
- Consumes: Task 7's sheet behavior.
- Produces: nothing new.

- [ ] **Step 1: Inventory every `TextInput`**

Run: `rg -n "TextInput" src --glob '*.tsx'`
Expected files, at minimum: `ImportScreen`, `SettingsScreen`, `EditTrackScreen`, `TagsScreen`, `SearchScreen`, `TagPicker`, `PlaylistCreateSheet`, `PlaylistEditSheet`, `PasteLyricsSheet`, `TrackActionsSheet` (inline new playlist). Each must be inside either the lifted `Sheet` or a screen that already uses `KeyboardAvoidingView`/`automaticallyAdjustKeyboardInsets`.

- [ ] **Step 2: Fix the Import link field**

`ImportScreen` is a plain `ScrollView`. Add `automaticallyAdjustKeyboardInsets` and `keyboardShouldPersistTaps="handled"` so focusing the link field scrolls it above the keyboard with its Download button. Do not add a `KeyboardAvoidingView` around the whole tab.

- [ ] **Step 3: Verify the anchored fields**

For `TagsScreen` and `SearchScreen`, the field is at the top and cannot be covered; keep them as is and record the check in the commit body. For `EditTrackScreen` and `SettingsScreen`, keep the existing `KeyboardAvoidingView` and confirm the submit/save action is reachable while typing.

- [ ] **Step 4: Run checks**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Device check**

On a dev build, focus every field from Step 1 and confirm the field and its primary action are visible. Record the result in `docs/research/v8-device-checks.md` (create the file if plan 2 has not).

- [ ] **Step 6: Commit**

```bash
git add src/screens/ImportScreen.tsx docs/research/v8-device-checks.md
git commit -m "fix(import): keep link field above keyboard"
```

---

## Self-Review

- Spec coverage: one indicator (Tasks 2–4), back exits (3–4), Library Tag and Add to playlist (5–6), select all (1–4), sheets above the keyboard (7–8).
- Interfaces: `SelectionState` is defined once in Task 1 and imported by Tasks 2, 4, 5; `tracksToAppend`/`addPlaylistTracks` are produced in Task 6 for plan 4.
- Review Focus lines each own a test or an explicit device step: filter-scoped select all (Task 1 test + Task 3 smoke), sheet-over-selection back (Step 3 registration order; NowPlaying is unmounted when Library selects), last-track deselect (existing screen behavior preserved; Task 4 hides selection on layer change), failed bulk write (Task 5 Step 5 refresh-on-throw), long list under keyboard (Task 7 smoke).
