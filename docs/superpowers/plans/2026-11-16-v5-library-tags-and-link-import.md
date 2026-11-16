# v5 Library Tags and Link Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship app-local tags end to end, shrink and cap Recently played, turn the Import tab into an action surface that returns to Library on success, and add YouTube link import through the documented ytmp3.ge API behind one testable module.

**Architecture:** Tags are app-local SQLite rows (`tags`, `track_tags`) with a single provider that owns counts and assignments. Filtering and bar visibility are pure functions so they are testable without React Native. The Import tab stops rendering a list; it keeps two action cards, exposes failures and progress, and hands the result to the shell, which navigates to Library and shows one toast. Link import lives in `src/imports/link.ts`: a pure URL validator, a pure response parser, and a converter that posts the form body, hands the download to the foundation's `downloadOwnedFile` (which owns naming, the cache-then-copy SAF fallback and partial-file cleanup), saves the thumbnail, probes duration when the response has none, and inserts a `download` record through `insertOwnedTrack`. Native modules are imported lazily inside the converter so the module still loads under `node --test`.

**Tech Stack:** Expo SDK 58, React Native 0.88, TypeScript, `expo-sqlite`, `expo-file-system` (`File.downloadFileAsync`, `Directory`, `Paths`), `expo-audio` (`createAudioPlayer` for duration probing), `expo-document-picker`, Ionicons, Node 24 `node:sqlite` for DB tests.

**Spec:** `docs/superpowers/specs/2026-11-16-krotify-v5-file-ownership-design.md` (source of truth).

**Prerequisite:** the v5 foundation plan (`2026-11-16-v5-track-store-and-imports.md`) has landed. This plan does not design the track store, the v5 schema and migration, storage picking, hidden tracks, player recovery, Settings, or lyrics.

## Assumed Foundation Contract

This plan consumes the following and says so explicitly. Do not redesign or duplicate them. If a symbol is missing, stop and land the foundation plan first, except for the tag modules this plan owns (see below).

| Symbol | Path | Consumed for |
|---|---|---|
| `insertOwnedTrack(input: NewOwnedTrack): Promise<TrackRecord>` | `src/tracks/repo.ts` | Inserting a downloaded track |
| `listActiveTracks(): Promise<TrackRecord[]>` | `src/tracks/repo.ts` | Library load (already wired by the foundation) |
| `updateTrackFields(id: string, patch: TrackFieldPatch): Promise<void>` | `src/tracks/repo.ts` | Foundation's DB-backed editor; this plan only adds tags to it |
| `toUiTrack(record: TrackRecord): Track` | `src/tracks/view.ts` | Turning a recorded download into the UI `Track` |
| `TrackRecord`, `NewOwnedTrack`, `TrackSource` | `src/tracks/types.ts` | Download records; `source: 'download'` lives here, not on the UI `Track` |
| `downloadOwnedFile(url: string, fileName: string, options?: { signal?: AbortSignal }): Promise<File>` | `src/storage/store.ts` | Link audio download, collision naming, SAF fallback, partial cleanup |
| `deleteOwnedFile(location: string): Promise<void>` | `src/storage/store.ts` | Removing a downloaded file after a post-download failure |
| `ImportFailure = { name: string; reason: 'unsupported' \| 'no audio data' \| 'copy failed' }` | `src/imports/local.ts` | The Import tab's failure card |
| `tags`, `track_tags` tables in `SCHEMA_SQL` and `PRAGMA foreign_keys = ON` | `src/db/schema.ts`, `src/db/index.ts` | All tag reads and writes |
| DB-backed `EditTrackScreen` (no `tagWriter`) | `src/screens/EditTrackScreen.tsx` | The Tags section is added to the existing form body |

Expected shapes (adapt at the call site only if the foundation names fields differently):

```ts
type NewOwnedTrack = {
  source: 'download';
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
  artworkHue?: number;
};
```

`probeDurationMs` is **not** provided by the foundation; Task 8 creates `src/imports/probe.ts` from the 2-second `createAudioPlayer` pattern already used in `src/imports/local.ts` and points that file at the new module. `Track` keeps its current `source: 'scan' | 'import' | 'demo'`; `toUiTrack` maps a download record to `'import'` for the UI.

Tag modules are authored here: `src/tags/repo.ts`, `src/tags/TagProvider.tsx`, and the helpers in `src/tags/`. The foundation only supplies the tables. If it landed partial versions, extend them in place and keep the names below. Never create a second tag module or a second source of tag truth.

## Decisions Locked

- **Tags are DB rows, not file metadata.** Assigning or unassigning in the editor writes immediately. It is not coupled to the Save button and never touches the audio file.
- **Bar contents:** All plus tags with at least one active track, sorted case-insensitively by name. The bar is hidden entirely when no tag has an active track. A selected tag that drops to zero active tracks clears back to All.
- **No add control in the filter bar.** A tag created there would have no tracks, so the same visibility rule would hide it immediately and the user would see nothing. Tags are created in the track editor. Revisit only if the bar later grows a create-and-assign flow.
- **Filter scope:** a tag filter narrows the flat track list. Recently played is hidden while a filter is active because an unfiltered rail above a filtered list reads as a bug. Liked Songs and Playlists stay visible because they are separate collections. The selected tag is in-memory only and resets to All on relaunch.
- **Import tab is an action surface.** No list, no "Recent imports" title, no import rows. It keeps the local import card, the link card, per-file failures, progress and an idle empty state.
- **Success navigation:** after a local import with at least one added file, or after a link download, the shell switches to Library and shows one toast. Partial failures stay available on the Import tab and the toast includes the failed count.
- **Link import:** one module, `src/imports/link.ts`, with a pure validator and parser and a converter. No other resolver, no `m.youtube.com`, no playlists, no embeds.
- **ytmp3 request:** `POST https://ytmp3.ge/api/convert`, `Content-Type: application/x-www-form-urlencoded`, body `youtube_url=<canonical>&quality=<128|192|256|320>`, default `192`, 300 s timeout, no auth.
- **Download ownership:** link audio is downloaded through the foundation's `downloadOwnedFile`, which picks a collision-free name, tries the direct path, falls back to cache-then-copy for SAF and removes partial files. The link module does not reimplement any of that. Progress is phase-based because `downloadOwnedFile` exposes a signal but not byte callbacks; extending it for byte progress is a separate change.
- **Cancel:** one `AbortController` covers the conversion fetch and the `downloadOwnedFile` signal. `downloadOwnedFile` removes partial files; the link module adds a check between phases and deletes a completed file when the user cancels or the insert fails.
- **Post-download insert failure deletes the downloaded file.** An orphan file the library cannot show is worse than a clean failure; the error says the download could not be added.
- **`LINK_IMPORT_ENABLED` is deleted.** The real link card replaces the stale disabled card.
- **No new runtime dependency.**

## Global Constraints

- Android first. A development build is required; Expo Go cannot prove SAF, storage-root downloads, or the tag DB.
- Local playback and tag edits work with no network and no account.
- Every task ends with `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`. One conventional commit per task. No push.
- Do not run a release build. `npx expo run:android` is only for the device checks.
- Tests are `node --test` with TypeScript type stripping, importing `../src/...ts` explicitly. Node 24 is required for `node:sqlite`.
- No comments unless they explain a non-obvious decision. The one expected comment is the lazy-import note in `src/imports/link.ts`.
- Copy uses no em dash. Icons are Ionicon names.
- Never claim a device pass without running it on a device and recording the result.

## Review Focus

1. **Tag filter correctness:** counts include only `status = 'active'` tracks; a tag with hidden or removed tracks never appears; filtering never mutates the source array; the selected chip clears exactly when its tag disappears.
2. **Empty-state hiding:** the tag bar is fully absent when no tag has an active track, including the first launch on a migrated install; the Import tab has no list and its idle copy does not imply a history.
3. **Import navigation:** a successful local import or download lands on Library with one toast; total failure stays on Import; partial failure preserves the failure card for the next visit.
4. **ytmp3 failure isolation:** invalid URLs fail before any network call; a service error or a timeout changes no track, no file, and no count; a failed thumbnail is non-fatal; a failed insert removes the downloaded file.
5. **SAF download:** the foundation's `downloadOwnedFile` is the only audio download path; it tries the direct write, falls back to cache then copy for a picked root, and leaves no partial file. The resulting file is non-zero, named safely (`uniqueFileName`), and listed by a file manager.

## File Map

| File | Responsibility |
|---|---|
| `src/tags/name.ts` | `normalizeTagName`: trim, collapse whitespace, 32-character cap |
| `src/tags/filter.ts` | `visibleTags`, `tagBarVisible`, `reconcileTagFilter`, `filterTracksByTag`, `assignmentsFromRows`, `setAssignment` |
| `src/tags/queries.ts` | SQL strings for active tag counts, active assignments, tags for one track |
| `src/tags/repo.ts` | `createTag`, `assignTag`, `unassignTag`, `listTagsWithCounts`, `listTagAssignments`, `listTagsForTrack` |
| `src/tags/TagProvider.tsx` | Tags, assignments, `refresh`, `createAndAssign`, `assign`, `unassign`, `tagsFor` |
| `src/components/TagEditor.tsx` | Assigned chips, tap to unassign, add field, errors |
| `src/components/TagFilterBar.tsx` | All plus visible tag chips; returns `null` when hidden |
| `src/screens/LibraryScreen.tsx` | Bar above Recently played, filtered empty state, hides the rail under a filter |
| `src/AppShell.tsx` | Tag refresh calls, selected tag, filtered list, import navigation, toast, link result |
| `App.tsx` | `TagProvider` above `AppShell` |
| `src/components/RecentlyPlayed.tsx` | 72 px cards, 8-item cap |
| `src/screens/ImportScreen.tsx` | Action surface, link card, progress, cancel |
| `src/lib/importResult.ts` | Toast copy for added and failed counts |
| `src/imports/link.ts` | URL validation, form body, response parsing, safe name, phase labels, converter |
| `src/imports/probe.ts` | `probeDurationMs`, created here from the 2-second pattern in `src/imports/local.ts` |
| `src/imports/local.ts` | Point its private probe at `src/imports/probe.ts`; no behavior change |
| `tests/tagFilter.test.ts` | Pure filter and visibility tests |
| `tests/tagName.test.ts` | Tag name normalization tests |
| `tests/tagDb.test.ts` | Schema cascade assertions, cascade behavior, active-count query |
| `tests/importResult.test.ts` | Import result copy |
| `tests/link.test.ts` | Realistic success JSON, error JSON, invalid and unsupported URLs, names, progress labels |

---

## Phase 1: Tags

### Task 1: Tag repository, queries and pure helpers

**Files:**
- Create: `src/tags/name.ts`, `src/tags/filter.ts`, `src/tags/queries.ts`, `src/tags/repo.ts`
- Test: `tests/tagName.test.ts`, `tests/tagFilter.test.ts`, `tests/tagDb.test.ts`

**Interfaces:**
- Produces: `normalizeTagName(raw: string): string | null`.
- Produces: `TagCount = { id: string; name: string; count: number }`.
- Produces: `visibleTags(tags: TagCount[]): TagCount[]` (count > 0, name order, non-mutating).
- Produces: `tagBarVisible(tags: TagCount[]): boolean`.
- Produces: `reconcileTagFilter(selected: string | null, tags: TagCount[]): string | null`.
- Produces: `filterTracksByTag<T extends { id: string }>(tracks: T[], tagId: string | null, assignments: ReadonlyMap<string, readonly string[]>): T[]`.
- Produces: `assignmentsFromRows(rows: { trackId: string; tagId: string }[]): Map<string, string[]>`.
- Produces: `setAssignment(map, trackId, tagId, assigned): Map<string, string[]>`.
- Produces: `TAG_ACTIVE_COUNT_SQL`, `TAG_ASSIGNMENTS_SQL`, `TAGS_FOR_TRACK_SQL`.
- Produces: `listTagsWithCounts(): Promise<TagCount[]>`, `listTagAssignments(): Promise<{ trackId: string; tagId: string }[]>`, `listTagsForTrack(trackId: string): Promise<Tag[]>`, `createTag(rawName: string): Promise<Tag | null>`, `assignTag(trackId: string, tagId: string): Promise<void>`, `unassignTag(trackId: string, tagId: string): Promise<void>`.
- Consumes: `getDb()` from `src/db/index.ts`; tag tables from the foundation schema.

- [ ] **Step 1: Confirm the foundation symbols and tables exist**

Run:
```bash
rg -n "insertOwnedTrack|downloadOwnedFile|toUiTrack" src
rg -n "CREATE TABLE IF NOT EXISTS (tags|track_tags)" src/db/schema.ts
```
Expected: the track repo, the storage store and `toUiTrack` exist, and both tables are declared with `ON DELETE CASCADE` on `trackId` and `tagId`. If not, stop and land the foundation plan.

- [ ] **Step 2: Write the failing pure helper tests**

Create `tests/tagFilter.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignmentsFromRows,
  filterTracksByTag,
  reconcileTagFilter,
  setAssignment,
  tagBarVisible,
  visibleTags,
} from '../src/tags/filter.ts';

const tag = (id: string, name: string, count: number) => ({ id, name, count });
const tracks = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];

test('shows only tags with at least one active track', () => {
  assert.deepEqual(visibleTags([tag('a', 'Road', 2), tag('b', 'Live', 0)]), [tag('a', 'Road', 2)]);
});

test('orders tags by name case-insensitively', () => {
  assert.deepEqual(
    visibleTags([tag('a', 'road', 1), tag('b', 'Ambient', 1)]).map((item) => item.name),
    ['Ambient', 'road'],
  );
});

test('hides the tag bar when no tag has an active track', () => {
  assert.equal(tagBarVisible([]), false);
  assert.equal(tagBarVisible([tag('a', 'Road', 0)]), false);
});

test('keeps the bar visible when at least one tag has tracks', () => {
  assert.equal(tagBarVisible([tag('a', 'Road', 1)]), true);
});

test('keeps a selected tag that still has active tracks', () => {
  assert.equal(reconcileTagFilter('a', [tag('a', 'Road', 1)]), 'a');
});

test('clears a selected tag that no longer has active tracks', () => {
  assert.equal(reconcileTagFilter('a', [tag('a', 'Road', 0)]), null);
  assert.equal(reconcileTagFilter('missing', [tag('a', 'Road', 1)]), null);
});

test('returns all tracks when no tag is selected', () => {
  assert.deepEqual(filterTracksByTag(tracks, null, new Map()), tracks);
});

test('filters tracks by the selected tag', () => {
  const assignments = assignmentsFromRows([
    { trackId: 't1', tagId: 'a' },
    { trackId: 't3', tagId: 'a' },
  ]);
  assert.deepEqual(filterTracksByTag(tracks, 'a', assignments), [{ id: 't1' }, { id: 't3' }]);
});

test('does not mutate the track list', () => {
  const input = [...tracks];
  filterTracksByTag(input, 'a', assignmentsFromRows([{ trackId: 't1', tagId: 'a' }]));
  assert.deepEqual(input, tracks);
});

test('groups assignment rows by track id', () => {
  const map = assignmentsFromRows([
    { trackId: 't1', tagId: 'a' },
    { trackId: 't1', tagId: 'b' },
  ]);
  assert.deepEqual(map.get('t1'), ['a', 'b']);
});

test('adds an assignment without mutating the previous map', () => {
  const before = assignmentsFromRows([{ trackId: 't1', tagId: 'a' }]);
  const after = setAssignment(before, 't2', 'b', true);
  assert.equal(before.has('t2'), false);
  assert.deepEqual(after.get('t2'), ['b']);
});

test('removes only the selected assignment', () => {
  const before = assignmentsFromRows([
    { trackId: 't1', tagId: 'a' },
    { trackId: 't1', tagId: 'b' },
  ]);
  const after = setAssignment(before, 't1', 'a', false);
  assert.deepEqual(after.get('t1'), ['b']);
  assert.equal(setAssignment(after, 't1', 'b', false).has('t1'), false);
});
```

Create `tests/tagName.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTagName, TAG_NAME_MAX } from '../src/tags/name.ts';

test('trims and collapses whitespace in tag names', () => {
  assert.equal(normalizeTagName('  Road   Trip '), 'Road Trip');
});

test('rejects an empty tag name', () => {
  assert.equal(normalizeTagName('   '), null);
});

test('rejects a tag name longer than the limit', () => {
  assert.equal(normalizeTagName('a'.repeat(TAG_NAME_MAX + 1)), null);
});

test('keeps a name at the limit', () => {
  assert.equal(normalizeTagName('a'.repeat(TAG_NAME_MAX)), 'a'.repeat(TAG_NAME_MAX));
});
```

Create `tests/tagDb.test.ts`. `expo-sqlite` cannot run under `node --test`, so this file asserts the declared DDL and proves the cascade and count SQL on a minimal in-memory database with the same column names:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../src/db/schema.ts';
import { TAG_ACTIVE_COUNT_SQL } from '../src/tags/queries.ts';

const MINIMAL_SCHEMA = `
CREATE TABLE tracks (id TEXT PRIMARY KEY, status TEXT NOT NULL);
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  createdAt INTEGER NOT NULL
);
CREATE TABLE track_tags (
  trackId TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  tagId TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(trackId, tagId)
);`;

function open(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(MINIMAL_SCHEMA);
  return db;
}

function counts(db: DatabaseSync): { id: string; name: string; count: number }[] {
  const rows = db.prepare(TAG_ACTIVE_COUNT_SQL).all() as {
    id: string;
    name: string;
    count: number;
  }[];
  return rows.map((row) => ({ id: row.id, name: row.name, count: row.count }));
}

test('track_tags declares a cascading track foreign key', () => {
  assert.match(
    SCHEMA_SQL,
    /CREATE TABLE IF NOT EXISTS track_tags[\s\S]*?REFERENCES tracks\(id\) ON DELETE CASCADE/,
  );
});

test('track_tags declares a cascading tag foreign key', () => {
  assert.match(
    SCHEMA_SQL,
    /CREATE TABLE IF NOT EXISTS track_tags[\s\S]*?REFERENCES tags\(id\) ON DELETE CASCADE/,
  );
});

test('the database connection enables foreign keys', () => {
  const source = readFileSync(new URL('../src/db/index.ts', import.meta.url), 'utf8');
  assert.match(source, /PRAGMA foreign_keys = ON/);
});

test('deleting a track removes its tag links', () => {
  const db = open();
  db.exec(`
    INSERT INTO tracks VALUES ('t1', 'active');
    INSERT INTO tags VALUES ('g1', 'Road', 1);
    INSERT INTO track_tags VALUES ('t1', 'g1');
    DELETE FROM tracks WHERE id = 't1';
  `);
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM track_tags').get() as { count: number }).count,
    0,
  );
});

test('deleting a tag removes its links', () => {
  const db = open();
  db.exec(`
    INSERT INTO tracks VALUES ('t1', 'active');
    INSERT INTO tags VALUES ('g1', 'Road', 1);
    INSERT INTO track_tags VALUES ('t1', 'g1');
    DELETE FROM tags WHERE id = 'g1';
  `);
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM track_tags').get() as { count: number }).count,
    0,
  );
});

test('active tag counts ignore hidden and removed tracks', () => {
  const db = open();
  db.exec(`
    INSERT INTO tracks VALUES ('t1', 'active'), ('t2', 'hidden'), ('t3', 'removed'), ('t4', 'active');
    INSERT INTO tags VALUES ('g1', 'Road', 1), ('g2', 'Live', 2);
    INSERT INTO track_tags VALUES ('t1', 'g1'), ('t2', 'g1'), ('t3', 'g1'), ('t4', 'g2');
  `);
  assert.deepEqual(counts(db), [
    { id: 'g2', name: 'Live', count: 1 },
    { id: 'g1', name: 'Road', count: 1 },
  ]);
});

test('active tag counts return zero for an unused tag', () => {
  const db = open();
  db.exec(`
    INSERT INTO tracks VALUES ('t1', 'active');
    INSERT INTO tags VALUES ('g1', 'Road', 1), ('g2', 'Unused', 2);
    INSERT INTO track_tags VALUES ('t1', 'g1');
  `);
  assert.deepEqual(counts(db), [
    { id: 'g1', name: 'Road', count: 1 },
    { id: 'g2', name: 'Unused', count: 0 },
  ]);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:
```bash
node --test tests/tagFilter.test.ts tests/tagName.test.ts tests/tagDb.test.ts
```
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/tags/filter.ts`, `src/tags/name.ts` and `src/tags/queries.ts`.

- [ ] **Step 4: Implement the pure modules**

`src/tags/name.ts`:
```ts
export const TAG_NAME_MAX = 32;

export function normalizeTagName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length === 0 || name.length > TAG_NAME_MAX) return null;
  return name;
}
```

`src/tags/filter.ts`:
```ts
export type TagCount = { id: string; name: string; count: number };

const byName = (a: { name: string }, b: { name: string }) => {
  const left = a.name.toLowerCase();
  const right = b.name.toLowerCase();
  return left < right ? -1 : left > right ? 1 : 0;
};

export function visibleTags(tags: TagCount[]): TagCount[] {
  return tags.filter((tag) => tag.count > 0).sort(byName);
}

export function tagBarVisible(tags: TagCount[]): boolean {
  return visibleTags(tags).length > 0;
}

export function reconcileTagFilter(selected: string | null, tags: TagCount[]): string | null {
  if (selected === null) return null;
  return visibleTags(tags).some((tag) => tag.id === selected) ? selected : null;
}

export function filterTracksByTag<T extends { id: string }>(
  tracks: T[],
  tagId: string | null,
  assignments: ReadonlyMap<string, readonly string[]>,
): T[] {
  if (tagId === null) return tracks.slice();
  return tracks.filter((track) => assignments.get(track.id)?.includes(tagId) === true);
}

export function assignmentsFromRows(
  rows: { trackId: string; tagId: string }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const current = map.get(row.trackId);
    if (current) current.push(row.tagId);
    else map.set(row.trackId, [row.tagId]);
  }
  return map;
}

export function setAssignment(
  map: ReadonlyMap<string, readonly string[]>,
  trackId: string,
  tagId: string,
  assigned: boolean,
): Map<string, string[]> {
  const next = new Map<string, string[]>();
  for (const [key, value] of map) next.set(key, [...value]);
  const current = next.get(trackId) ?? [];
  if (assigned) {
    if (!current.includes(tagId)) next.set(trackId, [...current, tagId]);
    return next;
  }
  const filtered = current.filter((id) => id !== tagId);
  if (filtered.length === 0) next.delete(trackId);
  else next.set(trackId, filtered);
  return next;
}
```

Note: `filterTracksByTag(tracks, null, ...)` returns `tracks.slice()` so callers can never mutate the source through the result. The test compares deep equality, not identity.

`src/tags/queries.ts`:
```ts
export const TAG_ACTIVE_COUNT_SQL = `
SELECT g.id AS id, g.name AS name, COUNT(t.id) AS count
FROM tags g
LEFT JOIN track_tags tt ON tt.tagId = g.id
LEFT JOIN tracks t ON t.id = tt.trackId AND t.status = 'active'
GROUP BY g.id, g.name
ORDER BY g.name COLLATE NOCASE ASC
`;

export const TAG_ASSIGNMENTS_SQL = `
SELECT tt.trackId AS trackId, tt.tagId AS tagId
FROM track_tags tt
JOIN tracks t ON t.id = tt.trackId
WHERE t.status = 'active'
ORDER BY tt.trackId ASC, tt.tagId ASC
`;

export const TAGS_FOR_TRACK_SQL = `
SELECT g.id AS id, g.name AS name
FROM tags g
JOIN track_tags tt ON tt.tagId = g.id
WHERE tt.trackId = ?
ORDER BY g.name COLLATE NOCASE ASC
`;
```

- [ ] **Step 5: Implement `src/tags/repo.ts`**

```ts
import { getDb } from '../db/index';
import { normalizeTagName } from './name';
import { TAG_ACTIVE_COUNT_SQL, TAG_ASSIGNMENTS_SQL, TAGS_FOR_TRACK_SQL } from './queries';
import type { TagCount } from './filter';

export type Tag = { id: string; name: string };

function newTagId(): string {
  return `tag:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function listTagsWithCounts(): Promise<TagCount[]> {
  const db = await getDb();
  if (!db) return [];
  return db.getAllAsync<TagCount>(TAG_ACTIVE_COUNT_SQL);
}

export async function listTagAssignments(): Promise<{ trackId: string; tagId: string }[]> {
  const db = await getDb();
  if (!db) return [];
  return db.getAllAsync<{ trackId: string; tagId: string }>(TAG_ASSIGNMENTS_SQL);
}

export async function listTagsForTrack(trackId: string): Promise<Tag[]> {
  const db = await getDb();
  if (!db) return [];
  return db.getAllAsync<Tag>(TAGS_FOR_TRACK_SQL, trackId);
}

export async function createTag(rawName: string): Promise<Tag | null> {
  const name = normalizeTagName(rawName);
  if (!name) return null;
  const db = await getDb();
  if (!db) return null;
  const existing = await db.getFirstAsync<Tag>(
    'SELECT id, name FROM tags WHERE name = ? COLLATE NOCASE',
    name,
  );
  if (existing) return existing;
  const id = newTagId();
  await db.runAsync(
    'INSERT OR IGNORE INTO tags (id, name, createdAt) VALUES (?, ?, ?)',
    id,
    name,
    Date.now(),
  );
  return db.getFirstAsync<Tag>('SELECT id, name FROM tags WHERE name = ? COLLATE NOCASE', name);
}

export async function assignTag(trackId: string, tagId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync(
    'INSERT OR IGNORE INTO track_tags (trackId, tagId) VALUES (?, ?)',
    trackId,
    tagId,
  );
}

export async function unassignTag(trackId: string, tagId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync('DELETE FROM track_tags WHERE trackId = ? AND tagId = ?', trackId, tagId);
}
```

`getAllAsync<TagCount>` works because `COUNT()` comes back as a number. If the foundation adds a `tag:` prefix convention, keep it.

- [ ] **Step 6: Run the tests to verify they pass**

Run:
```bash
node --test tests/tagFilter.test.ts tests/tagName.test.ts tests/tagDb.test.ts
```
Expected: all pass.

- [ ] **Step 7: Commit, then run the gate**

```bash
git add src/tags/name.ts src/tags/filter.ts src/tags/queries.ts src/tags/repo.ts tests/tagName.test.ts tests/tagFilter.test.ts tests/tagDb.test.ts
git commit -m "feat(tags): add tag repo and filter helpers"
```
```bash
npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web
```
Expected: all four pass. The task is not done until this line is green; fix forward in a new commit if it is not.

### Task 2: TagProvider and library refresh hooks

**Files:**
- Create: `src/tags/TagProvider.tsx`
- Modify: `App.tsx`, `src/AppShell.tsx`
- Test: none new (`setAssignment` and `assignmentsFromRows` are covered in Task 1; the provider is device-verified)

**Interfaces:**
- Produces: `TagContextValue = { tags: TagCount[]; assignments: ReadonlyMap<string, readonly string[]>; loaded: boolean; refresh(): Promise<void>; createAndAssign(trackId: string, name: string): Promise<Tag | null>; assign(trackId: string, tagId: string): Promise<void>; unassign(trackId: string, tagId: string): Promise<void>; tagsFor(trackId: string): Tag[] }`.
- Produces: `TagProvider({ children })`, `useTags()`.
- Consumes: `listTagsWithCounts`, `listTagAssignments`, `createTag`, `assignTag`, `unassignTag`, `assignmentsFromRows`, `setAssignment`.

- [ ] **Step 1: Implement the provider**

`src/tags/TagProvider.tsx` follows `FavoritesProvider` in shape: a single load on mount, `loaded` guards the first paint, mutations update the map optimistically and then call `refresh()` so the DB is the final truth. A failed mutation must roll back by refreshing and rethrow so the editor can show an error. `tagsFor` maps assigned ids against a memoized `tagsById`. `createAndAssign` returns `null` when `createTag` rejects an invalid name and does not assign anything.

- [ ] **Step 2: Wrap the shell**

In `App.tsx`, wrap `AppShell` with `TagProvider` inside `FavoritesProvider` and keep the provider order otherwise unchanged. No other file in the tree may import the tag repo directly for state; the provider is the only read path outside `TagEditor`.

- [ ] **Step 3: Refresh on library changes**

In `src/AppShell.tsx`, call `const { refresh: refreshTags } = useTags()` and invoke `void refreshTags()` at the end of the foundation's `refreshLibraryFromDb()`, which every load, scan, hide, restore, exclude and delete path already uses, and once after `handleImport` adds tracks. This keeps counts correct without a per-render query. If the foundation has no `refreshLibraryFromDb`, add the call after each handler that changes membership: `loadLibrary`, the scan toggle and rescan, `handleImport`, hide, restore, restore all, exclude all and delete. Do not refresh on metadata edits.

- [ ] **Step 4: Verify the app boots with the provider**

Run `npx expo run:android`. Expected: the app launches, Library loads, and there is no provider error. Tag behavior is verified in Task 3 and Task 4.

- [ ] **Step 5: Commit, then run the gate**

```bash
git add src/tags/TagProvider.tsx App.tsx src/AppShell.tsx
git commit -m "feat(tags): add tag provider and refresh hooks"
```
```bash
npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web
```
Expected: all four pass.

### Task 3: Tag editing in the track editor

**Files:**
- Create: `src/components/TagEditor.tsx`
- Modify: `src/screens/EditTrackScreen.tsx`
- Test: none (UI; device-verified)

**Interfaces:**
- Produces: `TagEditor({ trackId: string; readOnly?: boolean })`.
- Consumes: `useTags()`, `normalizeTagName`.
- Consumes: the foundation's DB-backed edit form; tags are added before the Save actions in `edit` mode and shown read-only in `details` mode.

- [ ] **Step 1: Build the editor**

`TagEditor` renders:
- a label `Tags`;
- assigned chips, each a 32 px pill with the name and a small `close` icon; tapping calls `unassign(trackId, tag.id)` with an accessibility label of `Remove tag <name>`;
- in read-only mode, the same chips without the icon and without press handlers; render nothing when there are no assigned tags;
- when not read-only, a `TextInput` with placeholder `Add a tag`, `onSubmitEditing`, and an `Add` button. Do not set `maxLength`; let normalization enforce the limit so the user sees the message. On submit: `const name = normalizeTagName(draft)`; when `null`, show `Enter a tag name of 32 characters or less.`; otherwise call `createAndAssign`; clear the field on success; show `Could not update tags. Try again.` on failure;
- a hint `No tags yet. Add one below.` when the library has no tags and nothing is assigned;
- `tagBusy` disables the field and button while a write is in flight but never blocks the Save button.

Use `colors.surfaceHi` for chips, `colors.accent` for the Add button, `type.meta`, `space.xs/sm/md`, and `borderRadius: 999`. Chips wrap with `flexDirection: 'row'` and `flexWrap: 'wrap'`, gap `space.sm`.

- [ ] **Step 2: Mount it in the editor**

In `src/screens/EditTrackScreen.tsx`, render `<TagEditor trackId={workingTrack.id} />` in `edit` mode after the numeric fields and before `error` and the action row. Render `<TagEditor trackId={workingTrack.id} readOnly />` in `details` mode after the detail rows. Do not show it in `rename` mode. Do not gate it on file write access.

- [ ] **Step 3: Verify on device**

Open a scanned track and an imported track, edit each, and check:
- add `Road` to track A and `Live` to track B; the chips appear immediately and the Save button is not required;
- tap a chip to unassign; it disappears immediately;
- type an empty name and a 40-character name: both show the inline message and create nothing;
- create a tag that already exists with different case (`road`): it assigns the existing `Road` chip, no duplicate;
- kill and relaunch the app, reopen both tracks: assignments persist;
- edit while offline: tags still save.

- [ ] **Step 4: Commit, then run the gate**

```bash
git add src/components/TagEditor.tsx src/screens/EditTrackScreen.tsx
git commit -m "feat(tags): edit tags in the track editor"
```
```bash
npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web
```
Expected: all four pass.

### Task 4: Tag filter bar and library filtering

**Files:**
- Create: `src/components/TagFilterBar.tsx`
- Modify: `src/screens/LibraryScreen.tsx`, `src/AppShell.tsx`
- Test: `tests/tagFilter.test.ts` already covers the logic; run it as a regression in Step 5

**Interfaces:**
- Produces: `TagFilterBar({ tags, selectedId, onSelect }: { tags: TagCount[]; selectedId: string | null; onSelect: (id: string | null) => void })`. Returns `null` when `!tagBarVisible(tags)`.
- Changes: `LibraryScreen` gains `tags: TagCount[]`, `selectedTagId: string | null`, `onSelectTag: (id: string | null) => void`.
- Changes: `AppShell` owns `selectedTagId`, reconciles it on `tags` change, and passes the filtered list to `LibraryScreen` while keeping the full list for search, playlists, Liked Songs, resume and default queues.

- [ ] **Step 1: Build the bar**

Horizontal `ScrollView`, `showsHorizontalScrollIndicator={false}`, `contentContainerStyle={{ paddingHorizontal: space.md, gap: space.sm }}`. Chips are 34 px tall, `borderRadius: 999`, `backgroundColor: colors.surfaceHi` when unselected and `colors.accent` when selected, `type.meta`, `paddingHorizontal: space.md`. `All` comes first and maps to `null`. Accessibility: `accessibilityRole="button"`, `accessibilityState={{ selected }}`, labels `Show all tracks` and `Filter by <name>`. Return `null` before rendering anything when hidden so no gap is left in the list header.

- [ ] **Step 2: Place it above Recently played**

In `LibraryScreen`, render `<TagFilterBar ... />` as the first child of a header `View`, then `<RecentlyPlayed>` only when `selectedTagId === null` and recents exist, then the Liked row and the Playlists rail as today. Remove the old `ListHeaderComponent` condition that tied the whole header to recents, Liked and Playlists, so the bar can render for a library with no recents. Add a filtered empty state: when `selectedTagId !== null` and `tracks.length === 0`, `ListEmptyComponent` shows `No tracks with this tag.` and a `Show all` button calling `onSelectTag(null)`.

- [ ] **Step 3: Wire the shell**

In `AppShell`:
```ts
const { tags, assignments, refresh: refreshTags } = useTags();
const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
useEffect(() => {
  setSelectedTagId((current) => reconcileTagFilter(current, tags));
}, [tags]);
const filteredTracks = useMemo(
  () => filterTracksByTag(tracks, selectedTagId, assignments),
  [tracks, selectedTagId, assignments],
);
```
The destructure above replaces the Task 2 provider call with one call that also exposes `tags` and `assignments`. Pass `tracks={filteredTracks}`, `tags={tags}`, `selectedTagId`, and `onSelectTag={setSelectedTagId}` to `LibraryScreen`. Keep `tracks` as the full active list for `SearchScreen`, `LikedScreen`, `PlaylistsScreen`, `recentTracks`, the resume lookup and `handleSelect`'s default queue. Tapping a filtered row queues the filtered list because `LibraryScreen` passes its own `tracks` to `onSelect`.

- [ ] **Step 4: Verify on device**

With two tags across three tracks:
- the bar shows `All`, `Live`, `Road`; `All` is selected at launch;
- select `Road`: only tagged rows remain, Recently played disappears, `All` restores everything;
- unassign `Road` from its last track in the editor, return to Library: the `Road` chip is gone; if it was selected, `All` is selected again and the full list returns;
- hide or clear the only track carrying a tag: the chip disappears and the bar hides when that was the last visible tag;
- create a tag on a track and return to Library: the chip appears without a rescan;
- kill and relaunch: tags persist and the selection resets to `All`;
- rotate and use a small phone: chips scroll horizontally and do not wrap.

- [ ] **Step 5: Run the regression and commit, then run the gate**

```bash
node --test tests/tagFilter.test.ts
```
Expected: all pass.
```bash
git add src/components/TagFilterBar.tsx src/screens/LibraryScreen.tsx src/AppShell.tsx
git commit -m "feat(library): add the tag filter bar"
```
```bash
npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web
```
Expected: all four pass.

---

## Phase 2: Library polish

### Task 5: Shrink and cap Recently played

**Files:**
- Modify: `src/components/RecentlyPlayed.tsx`
- Test: none (UI; device-verified)

**Interfaces:**
- Changes: card size `120` to `72`; rail data capped at 8; the queue passed to `onSelect` is the same capped list.

- [ ] **Step 1: Change the size and the cap**

Set `const SIZE = 72` and `const LIMIT = 8`. Compute `const visible = tracks.slice(0, LIMIT)` once and use it for `data`, and pass `visible` to `onSelect(item, visible)`. Do not slice inside `renderItem`. Keep the label `type.meta`, `numberOfLines={1}`, and the existing accessibility label.

- [ ] **Step 2: Verify on device**

Play at least 10 tracks. Recently played shows exactly 8 cards at 72 px, the rail still scrolls horizontally, tapping the third card starts playback from that card with the 8-card queue, and Library keeps one clean vertical rhythm with the tag bar above and the Liked row below.

- [ ] **Step 3: Commit, then run the gate**

```bash
git add src/components/RecentlyPlayed.tsx
git commit -m "feat(library): shrink recently played cards"
```
```bash
npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web
```
Expected: all four pass.

---

## Phase 3: Import as an action surface

### Task 6: Remove the recent imports list and navigate on success

**Files:**
- Create: `src/lib/importResult.ts`, `tests/importResult.test.ts`
- Modify: `src/screens/ImportScreen.tsx`, `src/AppShell.tsx`
- Delete: the `LINK_IMPORT_ENABLED` constant and the stale disabled card

**Interfaces:**
- Produces: `importResultMessage(added: number, failed: number): string`.
- Changes: `ImportScreen` props become `{ importing, importFailures: ImportFailure[], onImport, onOpenSearch, onOpenSettings }`; `imports` and `onSelect` are removed; the body is a `ScrollView`, not a `FlatList`. `ImportFailure` is imported from `src/imports/local` (the foundation deleted `src/library/imports.ts`).
- Changes: `AppShell` drops the `importedTracks` memo and the `imports` prop, adds a single toast state, and navigates after a successful import.
- Consumes: the foundation's `handleImport` result `{ added: TrackRecord[]; skipped; failures }` and `toUiTrack`.
- Keeps: local import card, per-file failures with the first reason, the `importing` spinner, and an idle empty state.

- [ ] **Step 1: Write the failing copy test**

`tests/importResult.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importResultMessage } from '../src/lib/importResult.ts';

test('reports a single imported file', () => {
  assert.equal(importResultMessage(1, 0), '1 file imported');
});

test('reports several imported files', () => {
  assert.equal(importResultMessage(3, 0), '3 files imported');
});

test('reports imported and failed counts together', () => {
  assert.equal(importResultMessage(2, 1), '2 files imported, 1 failed');
});

test('does not claim success when nothing was added', () => {
  assert.equal(importResultMessage(0, 2), 'No files were imported');
  assert.equal(importResultMessage(0, 0), '');
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
node --test tests/importResult.test.ts
```
Expected: FAIL because `src/lib/importResult.ts` does not exist.

- [ ] **Step 3: Implement the copy helper**

`src/lib/importResult.ts` returns `''` for no activity, `No files were imported` when only failures exist, and otherwise `N file(s) imported` with `, M failed` appended when `failed > 0`.

- [ ] **Step 4: Rewrite the Import screen**

Delete `LINK_IMPORT_ENABLED`, the `imports` prop, `onSelect`, the `FlatList`, `TrackRow`, `useScrollProgress`, `ScrollBar` and `listRef`. Confirm the `ImportFailure` import points at `../imports/local` (the foundation moved it there). Keep `ScreenHeader`, the local import card, `error`, `importFailures`, and the spinner. Replace the list with a `ScrollView` containing, in order:
1. the local import card;
2. the generic error card;
3. the per-file failure card with the first reason;
4. an idle empty state shown only when `!importing && importFailures.length === 0`: title `Nothing imported yet`, body `Pick audio files or paste a link. Imports appear in the Library tab.`;
5. bottom padding of `TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_BOTTOM_GAP + 32`.

No recent list, no `Recent imports` title, no import rows. The tab is an action surface.

- [ ] **Step 5: Add the toast and navigate from the shell**

In `AppShell`, replace `exitHint` with `const [toast, setToast] = useState<{ id: number; message: string } | null>(null)` and `const showToast = useCallback((message: string) => setToast({ id: Date.now(), message }), [])`. Render one `<Toast key={toast?.id} visible={toast !== null} message={toast?.message ?? ''} onHidden={() => setToast(null)} />`. The back handler's arm step calls `showToast('Press back again to exit')`.

In `handleImport`, after a successful batch with `added.length > 0`: keep the foundation's `mergeLibrary` of `added.map(toUiTrack)`, call `void refreshTags()`, call `selectTab('library')` (even if the foundation already switched, the call is idempotent), and `showToast(importResultMessage(added.length, failures.length))`. When `added.length === 0`, stay on Import and keep the failure card. Do not clear `importFailures` on navigation.

- [ ] **Step 6: Verify on device**

- Import two files: the app switches to Library, the files are listed, and the toast reads `2 files imported`.
- Import a batch with one bad file: the app switches to Library and the toast reads `N files imported, 1 failed`; go back to Import and the failure card still names the first reason.
- Cancel the picker: no navigation, no toast, no error.
- Pick only unreadable files: stay on Import with the failure card.
- Open Import with no history: no list, no "Recent imports", the idle empty state is readable and the tab has no dead scroll area.

- [ ] **Step 7: Commit, then run the gate**

```bash
git add src/lib/importResult.ts tests/importResult.test.ts src/screens/ImportScreen.tsx src/AppShell.tsx
git commit -m "refactor(import): drop the recent imports list"
```
```bash
npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web
```
Expected: all four pass.

---

## Phase 4: ytmp3 link import

### Task 7: Pure link validation, parsing and naming

**Files:**
- Create: `src/imports/link.ts` (pure exports only in this task), `tests/link.test.ts`
- Test: `tests/link.test.ts`

**Interfaces:**
- Produces: `YTMP3_ENDPOINT`, `LINK_TIMEOUT_MS = 300_000`, `LINK_QUALITIES`, `DEFAULT_LINK_QUALITY = 192`.
- Produces: `LinkQuality = 128 | 192 | 256 | 320`, `LinkTarget = { videoId: string; url: string }`.
- Produces: `parseYoutubeInput(raw: string): { ok: true } & LinkTarget | { ok: false; reason: string }`.
- Produces: `buildConvertBody(target: LinkTarget, quality: LinkQuality): string`.
- Produces: `LinkDownload = { videoId; title; thumbnail: string | null; durationMs; sizeBytes: number | null; downloadUrl }`.
- Produces: `parseConvertResponse(raw: string): { ok: true; data: LinkDownload } | { ok: false; error: string }`.
- Produces: `linkFileName(title: string): string`, `thumbnailExtension(url: string): string`.
- Produces: `LinkProgress = { phase: 'convert' | 'download' | 'thumbnail' | 'save' }` and `linkProgressLabel(progress: LinkProgress): string`.
- Note: collision naming is not reimplemented here. `downloadOwnedFile` and `uniqueFileName` in `src/storage` own it.

- [ ] **Step 1: Write the failing tests**

`tests/link.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConvertBody,
  linkFileName,
  linkProgressLabel,
  parseConvertResponse,
  parseYoutubeInput,
  thumbnailExtension,
} from '../src/imports/link.ts';

const SUCCESS = JSON.stringify({
  success: true,
  videoId: 'dQw4w9WgXcQ',
  title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  duration: 213,
  size: 3407872,
  downloadUrl: 'https://tmp.ytmp3.ge/dl/abc123.mp3',
});

test('parses a realistic success response', () => {
  assert.deepEqual(parseConvertResponse(SUCCESS), {
    ok: true,
    data: {
      videoId: 'dQw4w9WgXcQ',
      title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      durationMs: 213000,
      sizeBytes: 3407872,
      downloadUrl: 'https://tmp.ytmp3.ge/dl/abc123.mp3',
    },
  });
});

test('turns an error response into readable copy', () => {
  assert.deepEqual(
    parseConvertResponse(JSON.stringify({ success: false, error: 'This video is unavailable.' })),
    { ok: false, error: 'This video is unavailable.' },
  );
});

test('falls back when an error response has no message', () => {
  assert.deepEqual(parseConvertResponse(JSON.stringify({ success: false })), {
    ok: false,
    error: 'The download service could not convert this link.',
  });
});

test('cleans HTML from an error response', () => {
  assert.deepEqual(
    parseConvertResponse(JSON.stringify({ success: false, error: '<b>Rate</b>\n limited' })),
    { ok: false, error: 'Rate limited' },
  );
});

test('reports an unexpected response body', () => {
  assert.deepEqual(parseConvertResponse('<html>502</html>'), {
    ok: false,
    error: 'The download service sent an unexpected response.',
  });
});

test('rejects a success response without a file', () => {
  assert.deepEqual(parseConvertResponse(JSON.stringify({ success: true, title: 'A' })), {
    ok: false,
    error: 'The download service did not return a file.',
  });
});

test('accepts a watch link and canonicalizes it', () => {
  assert.deepEqual(
    parseYoutubeInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&t=10'),
    { ok: true, videoId: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  );
});

test('accepts a youtu.be link and drops the timestamp', () => {
  assert.deepEqual(parseYoutubeInput('https://youtu.be/dQw4w9WgXcQ?t=43'), {
    ok: true,
    videoId: 'dQw4w9WgXcQ',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  });
});

test('rejects a playlist link', () => {
  const result = parseYoutubeInput('https://www.youtube.com/playlist?list=PL123');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /Playlists are not supported/);
});

test('rejects an embed link', () => {
  const result = parseYoutubeInput('https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /Embed links are not supported/);
});

test('rejects invalid URLs and hosts', () => {
  for (const raw of [
    '',
    'youtube.com/watch?v=dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=too-short',
    'https://youtu.be/',
  ]) {
    assert.equal(parseYoutubeInput(raw).ok, false, raw);
  }
});

test('builds the form body with the canonical url and quality', () => {
  assert.equal(
    buildConvertBody(
      { videoId: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      192,
    ),
    'youtube_url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&quality=192',
  );
});

test('derives a safe file name from the title', () => {
  assert.equal(linkFileName('AC/DC: Back in Black'), 'AC-DC- Back in Black.mp3');
  assert.equal(linkFileName('Song.mp4'), 'Song.mp3');
  assert.equal(linkFileName(''), 'youtube-audio.mp3');
});

test('reads the thumbnail extension', () => {
  assert.equal(thumbnailExtension('https://i.ytimg.com/vi/x/hqdefault.jpg'), 'jpg');
  assert.equal(thumbnailExtension('https://i.ytimg.com/vi/x/hqdefault.png'), 'png');
  assert.equal(thumbnailExtension('https://i.ytimg.com/vi/x/hqdefault'), 'jpg');
});

test('labels every download phase', () => {
  assert.equal(linkProgressLabel({ phase: 'convert' }), 'Reading the link…');
  assert.equal(linkProgressLabel({ phase: 'download' }), 'Downloading…');
  assert.equal(linkProgressLabel({ phase: 'thumbnail' }), 'Saving artwork…');
  assert.equal(linkProgressLabel({ phase: 'save' }), 'Adding to Library…');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
node --test tests/link.test.ts
```
Expected: FAIL because `src/imports/link.ts` does not exist.

- [ ] **Step 3: Implement the pure part of `src/imports/link.ts`**

Rules:
- Parse with a regex, not `new URL`, because React Native's `URL` is not a full WHATWG implementation. Accept only `http(s)://`.
- Hosts: `youtube.com`, `www.youtube.com`, `youtu.be`, `www.youtu.be`. Reject `m.`, `music.`, and every other host.
- `youtube.com` path must be `/watch` with a `v` query value. `/playlist` returns the playlist reason. `/embed...` returns the embed reason. Anything else returns `Only youtube.com/watch and youtu.be links work.`
- `youtu.be` takes the first path segment. Ignore `t` and every other query parameter, including `list`, because the video id is explicit.
- Video id must match `^[A-Za-z0-9_-]{11}$`. Otherwise return `That link does not contain a valid video id.`
- Normalize to `https://www.youtube.com/watch?v=<id>` for the request.
- No scheme returns `Paste a full YouTube link starting with https://`.
- `parseConvertResponse` treats `success: false` as a readable error, cleans HTML tags and whitespace, caps the message at 180 characters, treats `success !== true` or a missing/non-http `downloadUrl` as no file, accepts numbers and numeric strings for `duration` (seconds, converted to ms) and `size` (bytes), and defaults the title to `YouTube audio`.
- `linkFileName` replaces `/ \ ? % * : | " < >` with `-`, collapses whitespace, strips a trailing audio/video extension, trims trailing dots and spaces, caps the base at 80 characters, and always appends `.mp3`. Collision suffixes are added later by the storage module, not here.
- `linkProgressLabel` returns `Reading the link…`, `Downloading…`, `Saving artwork…`, and `Adding to Library…`.

Every string is a plain export. Do not import React Native or Expo modules at the top level: the converter's native imports are added in Task 8 and must be lazy so this file stays loadable under `node --test`.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
node --test tests/link.test.ts
```
Expected: all pass. Then run `node --test` for the whole suite once to confirm no other test imports a native module through this file.

- [ ] **Step 5: Commit, then run the gate**

```bash
git add src/imports/link.ts tests/link.test.ts
git commit -m "feat(import): validate and parse ytmp3 links"
```
```bash
npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web
```
Expected: all four pass.

### Task 8: Download a link into the storage root

**Files:**
- Modify: `src/imports/link.ts` (add the converter)
- Create: `src/imports/probe.ts`
- Modify: `src/imports/local.ts` (use the shared probe; no behavior change)
- Test: none new (the pure parts are covered in Task 7; the converter is device-verified)

**Interfaces:**
- Consumes: `LinkProgress`, `LinkQuality`, `LinkDownload`, `parseYoutubeInput`, `parseConvertResponse`, `buildConvertBody`, `linkFileName`, `thumbnailExtension` from Task 7.
- Produces: `LinkImportOutcome = { ok: true; record: TrackRecord } | { ok: false; error: string; cancelled?: boolean }`.
- Produces: `importFromLink(rawUrl: string, quality: LinkQuality, options?: { signal?: AbortSignal; onProgress?: (progress: LinkProgress) => void }): Promise<LinkImportOutcome>`.
- Consumes lazily: `expo-file-system` (`File`, `Directory`, `Paths`) for the thumbnail only, the foundation's storage module (`downloadOwnedFile`, `deleteOwnedFile`; `src/storage/store.ts` in the foundation plan), `../tracks/repo` (`insertOwnedTrack`), `./probe` (`probeDurationMs`).
- Note: `downloadOwnedFile` resolves the storage root, picks a collision-free name, tries the direct write, falls back to cache then copy for a picked root, and removes partial files. The link module never builds a destination path for audio.

- [ ] **Step 1: Create the shared probe**

Read the private duration probe in `src/imports/local.ts` (the 2-second `createAudioPlayer` pattern that resolves `0` on timeout). Create `src/imports/probe.ts` exporting `probeDurationMs(uri: string): Promise<number>` with the same timeout and behavior, then change `local.ts` to import it and delete its private copy. Do not change the timeout, the listener setup or the `0`-on-timeout result.

- [ ] **Step 2: Implement the converter**

Sequence, no exceptions crossing the boundary:

1. `parseYoutubeInput`; return `{ ok: false, error: reason }` without any network call when invalid.
2. Report `{ phase: 'convert' }`.
3. Create an internal `AbortController`. Forward the caller's `signal` to it. Start a `LINK_TIMEOUT_MS` timer that sets `timedOut` and aborts.
4. `fetch(YTMP3_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: buildConvertBody(target, quality), signal: controller.signal })`; read `response.text()`; `parseConvertResponse` it. Do not branch on `response.ok` alone because the service can return JSON errors with a non-2xx status; a non-JSON body maps to the parser's unexpected-response error.
5. On a `fetch` rejection: if the caller's signal is aborted return `{ ok: false, cancelled: true, error: 'Download cancelled.' }`; if `timedOut` return `The download service timed out. Try again.`; otherwise return `Could not reach the download service. Check your connection.` Clear the conversion timer here, but keep the external abort listener attached so Cancel still reaches the download phase.
6. Report `{ phase: 'download' }` and:
   ```ts
   const file = await downloadOwnedFile(payload.downloadUrl, linkFileName(payload.title), {
     signal: controller.signal,
   });
   ```
   On rejection: if the caller's signal is aborted return cancelled; otherwise return `Could not download the file. Check your connection and the storage folder.` `downloadOwnedFile` already removed partial files.
7. When `!file.exists || file.size <= 0`, call `deleteOwnedFile(file.uri)` and return `The downloaded file is empty.`
8. Thumbnail: report `{ phase: 'thumbnail' }`, create `Paths.document/artwork`, download to `ytmp3-<videoId || Date.now()>.<ext>` with `{ idempotent: true }` and the thumbnail URL; keep the URI only when the file exists with a positive size. Any failure is swallowed and the record is inserted without artwork.
9. Duration: `payload.durationMs > 0 ? payload.durationMs : await probeDurationMs(file.uri).catch(() => 0)`.
10. Check the caller's signal once more before the DB write; when aborted, `deleteOwnedFile(file.uri)` and return cancelled.
11. Report `{ phase: 'save' }` and call:
   ```ts
   const record = await insertOwnedTrack({
     source: 'download',
     location: file.uri,
     fileName: file.name,
     sizeBytes: file.size > 0 ? file.size : payload.sizeBytes ?? undefined,
     durationMs,
     title: payload.title,
     artist: '',
     album: '',
     artworkUri,
   });
   ```
   On failure call `deleteOwnedFile(file.uri)` and return `Could not add the download to the library.`
12. Return `{ ok: true, record }`.

Wrap the whole sequence in `try/finally`: clear the timeout and remove the external abort listener on every exit, including early returns. Cancellation between phases checks `signal?.aborted`, not `controller.signal`, so an internal timeout is never reported as a user cancel.

The `TrackRecord` type is a type-only import from `src/tracks/types`. Cleanup must never throw. Native imports are lazy so the module still loads under `node --test`; add the single explanatory comment above the first lazy import.

- [ ] **Step 3: Typecheck the lazy imports**

Run `npx tsc --noEmit`. Expected: pass. If Metro complains at runtime about a lazy import, keep the `await import(...)` pattern used in `src/screens/EditTrackScreen.tsx` for the old native module; do not switch to top-level imports because that breaks `node --test`.

- [ ] **Step 4: Verify on device (Android dev build)**

`npx expo run:android`, then from a throwaway account or a test install:
- Storage is the default app-private `Krotify` folder. Paste a normal watch URL, choose 192, tap Download. Progress moves through reading, downloading, saving artwork and adding. Library opens with the returned title, the thumbnail, and the track plays. The duration matches real playback.
- Repeat with a `youtu.be` link carrying `?t=`. Same result.
- Change Storage in Settings to a public folder picked through SAF, then repeat. The file appears in that folder via the system file manager (name matches the title, non-zero size), and Library plays it. Note which download path the foundation's SAF spike reported and confirm no partial file remains.
- Paste a playlist URL and an embed URL: inline reasons, no request, no file.
- Paste a video ytmp3 reports as unavailable: readable error, Library count unchanged, no file in the folder.
- Airplane mode: conversion error, no crash, Library unchanged.
- Cancel during conversion: `Download cancelled.`, no file.
- Cancel during the file download: `Download cancelled.`, and the chosen folder has no partial file.
- Use a title with `/`, `:`, and a trailing space: the saved name replaces the illegal characters with `-` and ends in `.mp3`.
- Force a thumbnail 404 (or rename the thumbnail URL in a local test build): the track is still added without artwork.
- Confirm the Library duration equals the player's reported length; if it is 1000x too long, the service returned milliseconds and the unit assumption in Task 7 must be corrected before shipping.

- [ ] **Step 5: Commit, then run the gate**

```bash
git add src/imports/link.ts src/imports/probe.ts src/imports/local.ts
git commit -m "feat(import): download youtube audio via ytmp3"
```
```bash
npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web
```
Expected: all four pass.

### Task 9: Link card in the Import tab

**Files:**
- Modify: `src/screens/ImportScreen.tsx`, `src/AppShell.tsx`
- Test: none (UI; device-verified)

**Interfaces:**
- Changes: `ImportScreen` gains `onLinkImported: (record: TrackRecord) => void`; import `TrackRecord` as a type from `../tracks/types`.
- Consumes: `importFromLink`, `parseYoutubeInput`, `LINK_QUALITIES`, `DEFAULT_LINK_QUALITY`, `linkProgressLabel`, `LinkProgress`.
- Changes: `AppShell` adds `handleLinkImported(record: TrackRecord)`, which maps the record with `toUiTrack`.

- [ ] **Step 1: Build the link card**

Below the local import card and above the idle empty state, add a `From a link` card containing:
- a `TextInput` with `placeholder="https://youtube.com/watch?v=..."`, `autoCapitalize="none"`, `autoCorrect={false}`, `keyboardType="url"`, `editable={!linkBusy}`;
- a quality row of four chips for `LINK_QUALITIES`, default `DEFAULT_LINK_QUALITY`, `accessibilityRole="button"`, `accessibilityState={{ selected }}`, labels `128 kbps` through `320 kbps`;
- a neutral note line (`linkNote`) and a red error line (`linkError`);
- a progress line using `linkProgressLabel`;
- a `Download` button disabled when the trimmed URL is empty, `linkBusy`, or on web, plus a `Cancel` button while busy.

On web, render the card with the field and quality disabled and the meta `Available on device builds`, matching the local card.

- [ ] **Step 2: Wire the action and cancel**

State: `linkUrl`, `quality`, `linkBusy`, `linkNote`, `linkError`, `linkProgress`, and `abortRef = useRef<AbortController | null>(null)`. On Download: clear the note and error, run `parseYoutubeInput` first and show its reason inline without a spinner when invalid, otherwise create a controller, store it in `abortRef`, `setLinkBusy(true)`, call `importFromLink(url, quality, { signal: controller.signal, onProgress: setLinkProgress })`, and then:
- on `{ ok: true }`: clear the URL, note, error and progress, call `onLinkImported(record)`;
- on `{ ok: false, cancelled: true }`: set `linkNote` to `Download cancelled.`, clear the error;
- on `{ ok: false }`: set `linkError` to the message.

Cancel calls `abortRef.current?.abort()`. Abort on unmount in a cleanup effect. Clear `abortRef` and `linkProgress` in `finally`. Never navigate or change the library from this screen; the shell owns that.

- [ ] **Step 3: Handle the result in the shell**

`handleLinkImported(record)` maps the record first: `const track = toUiTrack(record)` (the adapter maps `source: 'download'` to `'import'`). Merge it into `libraryTracks` with `mergeLibrary(prev.filter((item) => item.source !== 'demo'), [track], new Set())`, set status to `ready`, clear `statusNote`, call `void refreshTags()`, call `selectTab('library')`, and `showToast(`Added ${track.title}`)`. Do not enrich a download again: the title, thumbnail, size and duration come from the response or the probe, and the foundation seeded nothing.

- [ ] **Step 4: Verify on device**

- The card shows the URL field and four quality chips with 192 selected without scrolling on a 6-inch phone.
- Download a valid link: the Import tab shows progress, then the app is on Library, the toast reads `Added <title>`, and the row is playable.
- Change quality to 320 and download again: both files appear with distinct numbered names.
- Tap Download with an empty field: disabled, no request.
- Paste a playlist URL: inline reason above the button, no spinner, no request.
- Cancel during conversion and during download: `Download cancelled.`, no row added.
- On web (`npx expo export --platform web` preview), the card is disabled and no runtime error appears.

- [ ] **Step 5: Commit, then run the gate**

```bash
git add src/screens/ImportScreen.tsx src/AppShell.tsx
git commit -m "feat(import): add the link import card"
```
```bash
npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web
```
Expected: all four pass.

---

## Acceptance

- Create a tag in the editor, assign it to two tracks, filter the Library by it, unassign it from both, and watch the bar hide when it was the last tag. Assignments survive a cold relaunch.
- A tag carried only by hidden or cleared tracks never appears in the bar, and the count query test proves it.
- Recently played shows 72 px cards and never more than 8.
- Import has no recent list, no `LINK_IMPORT_ENABLED` card, and still reports per-file failures and progress.
- A successful local import and a successful link download both land on Library with one toast and no second tap.
- A link failure, timeout, invalid URL or cancel changes no track, no file and no count.
- A SAF storage root receives the downloaded file with a safe name and a non-zero size; the cache-then-copy fallback is exercised and recorded.
- `npm test`, `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform web` pass. Device results are recorded, not assumed.

## Open Risks

- **ytmp3 duration unit:** the API contract does not name the unit. This plan treats `duration` as seconds. The Task 8 device check compares the stored duration to real playback; if wrong, the fix is one line in `parseConvertResponse`.
- **Storage module behavior:** `downloadOwnedFile` owns collision naming, the direct-write attempt and the cache-then-copy fallback. If the foundation changes it to expose byte progress or a different error shape, adapt the error mapping and the phase labels in Task 8; do not fork the download path here.
- **Post-download insert failure:** the file is deleted with `deleteOwnedFile` so the library and folder stay consistent. If the foundation makes `insertOwnedTrack` non-atomic, revisit this.
- **Selection persistence:** the selected tag is in-memory and resets to All on relaunch, by decision. Users who expect stickiness will notice.
- **Spec ambiguity resolved here:** the bar has no add control because a zero-track tag would be hidden immediately. If product wants creation from the bar, it needs an assign-on-create flow, which is not in this plan.
