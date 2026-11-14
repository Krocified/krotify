# v3 Batch Edit Scope

**Verdict:** design only, no code. The smallest useful slice is a Library
selection mode that applies `artist`, `album`, `albumArtist`, and `genre` to
imported or write-granted scanned tracks, sequentially, with a progress count
and a per-file failure list. No title, artwork, track number, or undo.
**Date:** 2026-11-14
**Worktree:** `feat/stretch-research` from `feat/v3-v4` (`f385524`).
**Evidence:**
- `src/library/tagWriter.ts:94` — `createTagWriter`; `:147` — `applyTagEdit`.
- `src/lib/tagPatch.ts:24-25` — writable `TagFields`.
- `src/screens/LibraryScreen.tsx:89-90` — row press/long-press wiring.
- `src/AppShell.tsx:189` — `handleSelect`; `:351-386` — screen props.
- `modules/audio-tags/android/.../AudioTagsModule.kt:112-137` —
  `requestWriteAccess` is one prompt for a URI list and is all-or-nothing.
- `docs/spec.md:154-170` — ownership and "batch edit is a stretch".

## What exists

- `TagFields` already covers `title`, `artist`, `album`, `albumArtist`,
  `trackNumber`, `discNumber`, `year`, `genre`, `explicit`. Artwork is a native
  writer argument, not a `TagFields` key.
- `applyTagEdit(track, patch)` is a complete one-file transaction: validate,
  snapshot, atomic native write, update the metadata cache, discard the
  snapshot, return the refreshed track. A failure leaves the original intact;
  a cache failure restores the snapshot.
- There is no batch runner, no selection state, and no edit form in this
  worktree. Task 6 owns the single-track edit screen and action sheet; batch
  edit must reuse its form primitives and the same writer, not grow a second
  tag path.
- Scanned `content://` files can be written only after
  `requestWriteAccess(uris)`. Android grants the whole list or nothing. Imported
  `file://` copies need no grant. Demo tracks have no writable URI. Web has no
  native tag module.

## Selection model

- State lives in `LibraryScreen` (or a small `useSelection` hook) and is keyed
  by `track.id`, never by row index:
  `{ mode: boolean; ids: Set<string> }`.
- Entry: a header "Select" action on the Library screen, visible only when
  `Platform.OS !== 'web'` and at least one writable track exists. Long-press
  keeps the Task 6 action sheet; it does not enter selection mode. This avoids
  fighting the existing long-press contract.
- In selection mode: tap toggles selection and never starts playback;
  long-press also toggles. Rows show a check and
  `accessibilityState={{ selected }}`. The header becomes "N selected" with
  Cancel; the normal header actions are hidden.
- "Select all" selects the currently visible, writable tracks (the same
  `tracks` array the list renders, minus demo). "Clear" empties the set.
- Exiting selection mode, changing tabs, or pressing Android back clears the
  set. If the library refreshes while selecting, keep IDs; at apply time skip
  any selected ID that is no longer in the current library and report it as
  "no longer available".
- A bottom action bar above the tab bar carries "Edit tags" (disabled at zero)
  and "Select all/Clear". It uses the same sheet surface as Task 6, not an
  `Alert`.

No range selection, no cross-screen selection, and no persistence across
restarts in the smallest slice.

## Shared fields

Batch editing means "set every selected file to this value"; blank means
"leave unchanged". The form must require at least one non-blank field, which
`validateTagPatch` already enforces.

| Field | Batch? | Reason |
| --- | --- | --- |
| `artist` | yes | Common compilation/featured-artist fix. |
| `album` | yes | Album rename and split/merge cleanup. |
| `albumArtist` | yes | The highest-value batch field. |
| `genre` | yes | Library-wide genre cleanup. |
| `year` | yes | Box-set/year correction. |
| `discNumber` | later | Same value is rarely correct across arbitrary selections. |
| `explicit` | later | Batch-marking explicit content is a policy decision; add only with a deliberate toggle. |
| `trackNumber` | no | Same number for every file is almost always wrong. |
| `title` | no | Per-file by definition; single-track edit owns it. |
| artwork | no | Not part of `TagFields`; `applyTagEdit` has no artwork parameter. Artwork stays a single-track Task 6 feature. |

Do not add per-file overrides to the batch form. If one file needs a different
value, cancel and edit it individually.

## Apply per file

Use the existing writer once per selected track, sequentially:

1. Build and validate one `TagFields` patch for the whole batch. An invalid
   patch fails before any file is touched.
2. Partition the selection into `file://` tracks (ready), `content://` tracks
   (need grant), and demo/no-URI tracks (unavailable).
3. Call `requestWriteAccess(contentUris)` once. If it resolves empty, mark those
   content tracks as `NO_WRITE_ACCESS` and continue with the ready tracks. Do
   not loop permission prompts.
4. For each ready track in library order: `await applyTagEdit(track, patch)`,
   record success or a `TagWriteError` code, update the in-memory library entry
   from the returned track, and advance progress.
5. Stop only between files when the user asks to stop. The file in flight is
   allowed to finish; already-written files stay written. There is no
   cross-file transaction and no rollback of successful files.
6. On completion, refresh derived groups (Albums/Artists) from the updated
   tracks and leave failed tracks selected for a retry.

Sequential is deliberate. Each write copies the file twice (snapshot plus
atomic temp), so parallel writes multiply disk I/O and peak cache use, and they
make progress and failure ordering nondeterministic. The JS thread is not
blocked because the native calls are async.

Do not call native `writeTags` directly from the batch runner. That would skip
validation, snapshot rollback, and the metadata cache update. Batch is a loop
over `applyTagEdit`, not a second writer.

## Progress

One in-app progress sheet with:

- `completed / total` and a determinate bar;
- the current track title (truncated, one line);
- a "Stop after this file" action;
- a compact failure count that updates as failures occur.

The batch runner takes an `onProgress({ completed, total, track, failed })`
callback with injected `applyTagEdit`, so the loop is unit-testable without
native code. Progress and state updates are emitted after each settled file,
not on a timer. The sheet cannot be dismissed by backdrop tap while running;
Cancel means "stop after this file", and the sheet stays until the batch
settles so the result is visible.

## Partial-failure reporting

Return a result object rather than throwing at the first error:

```
{ updated: Track[], failed: { track, code, message }[], skipped: { track, reason }[] }
```

Result sheet wording:

- Header: "Updated 12 of 15 tracks."
- Failures grouped by code with track title and a short reason:
  - `NO_WRITE_ACCESS` — "No write access. Import a copy to edit this file."
  - `UNSUPPORTED_FORMAT` — "This file format cannot be tagged."
  - `FILE_NOT_FOUND` — "The file is missing."
  - `CACHE_FAILED` — "Could not update the library cache; the original file was restored."
  - `UNAVAILABLE` — "This track has no writable file."
  - `WRITE_FAILED` — "The write failed; the original file is intact."
- "Retry failed" reruns only the failed set with the same patch.
- Successful tracks drop out of the selection; failures stay selected.

Never claim the whole batch succeeded because the loop finished. The result
must always distinguish updated, failed, and skipped.

## Smallest slice

Ship only this:

1. Library header "Select" (native only), tap-to-toggle, count, Select all,
   Clear, Cancel.
2. Batch form with `artist`, `album`, `albumArtist`, `genre`; blank = unchanged;
   one validation pass before writing.
3. Preflight one write-access request for scanned content URIs; imported files
   proceed regardless.
4. Sequential `applyTagEdit` loop with progress count, current title, and
   "Stop after this file".
5. Result sheet with updated/failed/skipped counts and per-file failure codes;
   retry failed.
6. Unit tests for the runner with an injected writer: order, partial failure,
   cancellation boundary, progress emissions, and no write on invalid patch.

Explicit non-goals: title, artwork, track/disc number, explicit flag, per-file
overrides, undo/history, background batch after app exit, web, cross-screen
selection, and batch delete.

## Risks and rulings

- **Permission is all-or-nothing.** One denied scanned file denies the whole
  `content://` set. Ruling: report the set as skipped, still update imported
  files, and offer the existing "import a copy" path per file. Do not issue one
  prompt per file.
- **Large batches are slow.** Two copies per file can take minutes. Ruling:
  always show `x / N` and the current title; never freeze the UI behind a
  spinner with no count.
- **No undo.** The writer restores on cache failure but does not keep successful
  snapshots. Ruling: no undo in the slice; do not advertise it. Originals are
  intact only for failed writes.
- **Library state can drift.** Files can disappear or be excluded mid-batch.
  Ruling: resolve each track at write time and report missing entries as
  skipped, not failures.
- **One tag path.** Any future artwork batch requires extending
  `applyTagEdit` to pass an artwork URI through snapshot/write/cache; do not
  bypass it.

## Why this shape

The writer already gives the hard guarantees: atomic replace, cache consistency,
and original-file safety. Batch edit is therefore orchestration, not new tag
logic. Keying selection by ID, applying one file at a time through
`applyTagEdit`, and reporting per-file outcomes gives the smallest feature that
is honest about partial failure. Anything broader (title, artwork, undo,
background work) turns a stretch into a second editing system.
