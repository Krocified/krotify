# v5 Track Store and Imports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SQLite the source of truth for every track and make the audio file an immutable owned copy. This foundation delivers the v4 schema, the `src/tracks` repository, read-once metadata seeding, a chosen storage root, a local import that cannot falsely fail, and a scan that upserts instead of rebuilding the library.

**Architecture:** Correctness moves from the file boundary to the database. A `tracks` row carries display name, tags, artwork and app state. Files are copied once into a chosen root and never renamed or retagged. Legacy scan ids stay bare MediaStore asset ids and legacy imports stay `import:<hash>`; only new owned files use `own:<uuid>`. Read paths stop re-reading tags: tags seed the row once on entry, and edits are plain SQLite writes. MediaStore scanning becomes an upsert keyed by asset id, and owned files are excluded from scan results by root prefix with a name and size fallback. UI screens keep the existing `Track` shape through a single adapter, so this plan does not redesign surfaces.

**Tech Stack:** Expo SDK 58, React Native 0.88, TypeScript, `expo-sqlite` (~58.0.16), `expo-file-system` (~58.0.13, `Directory.pickDirectoryAsync`, `File.downloadFileAsync`), `expo-document-picker` (~58.0.5), `expo-media-library` (~58.0.13), `expo-audio` (~58.0.11), `@missingcore/react-native-metadata-retriever` (4.0.0-beta.2), `node:sqlite` in tests only.

**Spec:** `docs/superpowers/specs/2026-11-16-krotify-v5-file-ownership-design.md` is the source of truth. `docs/spec.md` records v0 through v4.

## Decisions Locked

- **Ids:** a scan track keeps its bare MediaStore asset id. A migrated import keeps `import:<hash>` from the stored row. A new owned file uses `own:<uuid>`. No legacy id is rewritten, ever. Favorites, playlists, history, lyrics and resume keep resolving by id.
- **Scan identity is the asset id:** scan tracks are never matched by path or by name plus size. If Android reissues an id after a move or a restore, the file appears as a new track. Name plus size is used only to keep an owned copy out of scan results.
- **Migration order:** create tables, insert imports, fold `track_metadata`, hide excluded ids, then write defaults. Imports are inserted first so their cached metadata folds into the import row instead of becoming a phantom scan row.
- **`track_metadata` stays for one release.** v4 folds it and stops writing it. It is not dropped in this plan.
- **Imports come from AsyncStorage only during migration.** `src/db/index.ts` reads `krotify.imports.v1` and `krotify.excluded.v1` before the migration transaction and passes parsed values into a pure migration function. Nothing writes those keys afterwards.
- **Storage default:** a fresh install (`user_version` 0) uses `Paths.document/Krotify`. An upgrade from v1, v2 or v3 uses `Paths.document/imports`. Migration records `storageRootKind` and the storage module reads it.
- **Owned id source:** `globalThis.crypto?.randomUUID?.()` when available, otherwise a v4-shaped string built from `Math.random`. No crypto dependency is added; these ids are opaque keys, not secrets.
- **Immutability:** after a copy, the app never renames, retags or replaces a file. Rename and tag edits are DB writes.
- **Clear vs Delete:** Clear sets `status = 'removed'` and keeps the row and the file, for every source. Delete removes the row and, for an owned file, the file, after a confirmation that names the track.
- **Scan/owned dedupe:** skip an asset under the owned root by path prefix when the root is a `file://` path; otherwise skip by `fileName + ':' + size` against active and removed owned rows. Both rules run when both are available.
- **UI shape:** AppShell keeps `Track[]` state and maps records with `toUiTrack`. Screens are adapted only at their imports and save path, not redesigned.
- **Hidden re-import:** a name and size match against a `hidden` owned row is reported as skipped and stays hidden. Only `removed` reactivates.
- **Explicit:** the `explicit` column ships for migrated values and future sources. The metadata retriever exposes no advisory flag, so seeding never writes it.

## Global Constraints

- Local-first. Playback, editing, scanning and importing work with no network and no account.
- A file is immutable after it is copied into the library. No in-place tag writes, no renames, no copy-to-edit fallback.
- Clear never deletes a file. Delete always confirms and names the track first.
- No new runtime dependency without `npx expo install` resolving the SDK-compatible version. This plan needs none.
- Android first. Audio, MediaStore, SAF and downloads need a development build; Expo Go cannot prove them.
- Never claim a device pass without running it on a device and recording the result in the evidence doc.
- No comments in code unless they explain a non-obvious decision. Conventional Commits. No push without an explicit instruction.
- Every task ends with `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`.
- Icons are Ionicon names. Copy uses no em dash.

## Review Focus

1. **Migration id integrity:** favorites, `playlist_tracks`, `play_history`, `lyrics_cache` and the resume key must resolve to the same track ids after v3 to v4. A migration test on a real v3 fixture and an upgrade install prove it.
2. **Import false failure:** a non-zero copy must import even when the provider-reported size is missing or different. The only size test is `destination.size > 0`.
3. **SAF operations:** create, copy, delete, list and download into a picked folder must be proven on a device. If download to SAF fails, the cache-then-copy fallback must run. If the root does not survive relaunch, switch to a persistable grant (legacy `StorageAccessFramework` or a native `takePersistableUriPermission`); the Change folder setting is a v5 requirement, not an optional extra.
4. **Scan and owned dedupe:** an owned copy must never appear twice, including when the root is a public folder that MediaStore scans. Removed rows must never be re-added, and hidden rows must stay hidden.
5. **Removed tombstones:** Clear keeps the file, a rescan cannot resurrect the row, a re-import reactivates instead of duplicating, and reclaimable space is computed from files that still exist.
6. **Read-once seeding:** a relaunch must not overwrite a user edit with file tags. Editing a title and relaunching is the proof.

---

## File Map

| File | Responsibility |
|---|---|
| `src/db/schema.ts` | v4 table DDL, indexes, `DB_VERSION = 4`, v2/v3 column helpers |
| `src/db/legacy.ts` | Pure parsers for the AsyncStorage import and exclusion payloads |
| `src/db/migrateV4.ts` | Injectable v3 to v4 migration: imports, metadata fold, excluded, defaults |
| `src/db/index.ts` | Reads legacy keys, runs v4 migration in a transaction, sets `user_version` |
| `src/db/settings.ts` | `settings` get/put plus the scan summary helpers |
| `src/tracks/types.ts` | `TrackRecord`, `TrackSource`, `TrackStatus`, input and patch types |
| `src/tracks/ids.ts` | Legacy id guards and `own:` id generation |
| `src/tracks/rows.ts` | Pure row builders for scan and owned rows |
| `src/tracks/sql.ts` | Shared SQL constants and the whitelisted update builder |
| `src/tracks/repo.ts` | Track repository: list, get, upsert, insert, update, status, delete, counts |
| `src/tracks/seed.ts` | Read-once file tags and embedded artwork extraction |
| `src/tracks/seedMap.ts` | Pure seed to `TrackFieldPatch` mapping |
| `src/tracks/scanPlan.ts` | Pure owned-root and name/size scan filtering |
| `src/tracks/scanSync.ts` | Scan candidates to upsert, seeding of new ids, scan summary |
| `src/tracks/view.ts` | `TrackRecord` to UI `Track` adapter |
| `src/tracks/editPatch.ts` | Pure edit form to `TrackFieldPatch` builder |
| `src/storage/types.ts` | `StorageRoot` shape |
| `src/storage/names.ts` | Flat-layout collision names |
| `src/storage/root.ts` | Get, choose, move and inspect the storage root |
| `src/storage/store.ts` | Copy a source file or download a URL into the root |
| `src/imports/plan.ts` | Pure copy validation and duplicate/reactivation decisions |
| `src/imports/local.ts` | `pickAndImportTracks` into the chosen root |
| `src/imports/local.web.ts` | Web stub for the import module |
| `src/lib/artworkInput.ts` | Artwork MIME and size validation shared by edit and playlist covers |
| `src/library/scan.ts` | MediaStore paging plus resolved URI and size candidates |
| `src/AppShell.tsx` | Load from `src/tracks`, status transitions, import and scan wiring |
| `src/screens/EditTrackScreen.tsx` | Save edits as DB writes; no access check, no tag write |
| `src/screens/ImportScreen.tsx` | Import failure type import only |
| `src/library/playlistArtwork.ts` | Import `MAX_ARTWORK_BYTES` from the new artwork input module |
| `tests/fixtures/v3.ts` | Real v3 SQLite fixture built with `node:sqlite` |
| `tests/tracksMigration.test.ts` | Migration ordering and id integrity |
| `tests/trackIds.test.ts` | Owned and legacy id rules |
| `tests/tracks.test.ts` | Upsert, update, count and tombstone SQL behavior |
| `tests/seedMap.test.ts` | Read-once seed mapping |
| `tests/storageNames.test.ts` | Collision suffix rules |
| `tests/importPlan.test.ts` | Copy validation and import decisions |
| `tests/editPatch.test.ts` | Edit patch and artwork validation |
| `tests/scanPlan.test.ts` | Owned-root scan exclusion |
| `tests/settings.test.ts` | Scan summary parsing |
| `docs/research/v5-saf-spike.md` | SAF spike evidence and persistence result |
| `docs/research/v5-foundation-device-check.md` | Foundation device matrix and evidence |
| `src/library/imports.ts`, `src/library/imports.web.ts` | Deleted: AsyncStorage import path and `importTrackCopy` |
| `src/library/exclusions.ts` | Deleted: replaced by `tracks.status` |
| `src/library/tagWriter.ts`, `src/lib/tagPatch.ts`, `modules/audio-tags/**` | Deleted: in-place tag writing |
| `tests/tagWriter.test.ts`, `tests/tagPatch.test.ts` | Deleted with the tag writer |

---

## Phase 1: Data layer

### Task 1: SQLite schema v4 and the v3 to v4 migration

**Files:**
- Modify: `src/db/schema.ts`, `src/db/index.ts`
- Create: `src/db/legacy.ts`, `src/db/migrateV4.ts`, `src/db/settings.ts`, `tests/fixtures/v3.ts`, `tests/tracksMigration.test.ts`

**Interfaces:**
- Changes: `DB_VERSION = 4`.
- Produces: `V4_TABLE_SQL: string` with `tracks`, `tags`, `track_tags` and `settings`, plus `tracks_location_idx` and `tracks_status_idx`.
- Changes: `SCHEMA_SQL` includes `V4_TABLE_SQL`, so a fresh install gets v4 tables.
- Produces: `LegacyImport = { id: string; uri: string; title: string; artist: string; durationMs: number; artworkHue?: number }`.
- Produces: `LegacyExcluded = { id: string }`.
- Produces: `parseLegacyImports(raw: string | null): LegacyImport[]` and `parseLegacyExcluded(raw: string | null): LegacyExcluded[]`.
- Produces: `MigrationDb = { all<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>; run(sql: string, ...params: (string | number | null)[]): Promise<unknown>; exec(sql: string): Promise<void> }`.
- Produces: `MigrationInput = { fromVersion: number; now: number; imports: LegacyImport[]; excluded: LegacyExcluded[]; fileExists: (location: string) => boolean }`.
- Produces: `migrateV3ToV4(db: MigrationDb, input: MigrationInput): Promise<{ importRows: number; scanSeeds: number; hidden: number }>`.
- Produces: `getSetting(key: string): Promise<string | null>` and `putSetting(key: string, value: string): Promise<void>`.
- Keeps: `pendingColumnMigrations`, `pendingPlaylistColumnMigrations`, `track_metadata` and every v1 to v3 table unchanged.

- [ ] **Step 1: Verify the current tree before touching it**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`
Expected: all pass. If not, stop and record the failing command before changing anything.

- [ ] **Step 2: Write the v3 fixture and the failing migration tests**

Create `tests/fixtures/v3.ts` with `createV3Fixture()`:
```ts
import { DatabaseSync } from 'node:sqlite';
import type { MigrationDb } from '../../src/db/migrateV4.ts';

export function createV3Fixture() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  raw.exec(`
    CREATE TABLE playlists (id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt INTEGER NOT NULL, description TEXT, artworkUri TEXT);
    CREATE TABLE playlist_tracks (playlistId TEXT NOT NULL, trackId TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY(playlistId, trackId));
    CREATE TABLE favorites (trackId TEXT PRIMARY KEY, addedAt INTEGER NOT NULL);
    CREATE TABLE play_history (id INTEGER PRIMARY KEY AUTOINCREMENT, trackId TEXT NOT NULL, playedAt INTEGER NOT NULL);
    CREATE TABLE track_metadata (id TEXT PRIMARY KEY, title TEXT, artist TEXT, album TEXT, albumArtist TEXT, year INTEGER, trackNumber INTEGER, discNumber INTEGER, genre TEXT, artworkUri TEXT, explicit INTEGER);
    CREATE TABLE lyrics_cache (trackId TEXT PRIMARY KEY, kind TEXT NOT NULL, text TEXT, fetchedAt INTEGER NOT NULL);
  `);
  const db: MigrationDb = {
    all: async <T>(sql: string, ...params: (string | number | null)[]) =>
      raw.prepare(sql).all(...params) as T[],
    run: async (sql: string, ...params: (string | number | null)[]) =>
      raw.prepare(sql).run(...params),
    exec: async (sql: string) => raw.exec(sql),
  };
  return { raw, db };
}
```
Add fixture helpers that insert one playlist, one `playlist_tracks` row at position 1000, one favorite for `12345`, one `play_history` row for `import:legacy`, one `lyrics_cache` row for `12345`, and one `track_metadata` row for `12345`.

Add `tests/tracksMigration.test.ts` with these tests, each using a fresh fixture:
- `'schema version is four'` asserts `DB_VERSION === 4`.
- `'v4 schema creates tracks tags track_tags and settings'` executes `V4_TABLE_SQL` and asserts the four tables plus both indexes exist in `sqlite_master`.
- `'legacy import parser keeps only import tracks with a location'` feeds valid JSON plus `{ id: 'x' }`, a non-object and a `source: 'scan'` row.
- `'legacy exclusion parser reads ids from stored tracks'` feeds the v1 exclusion payload and asserts the ids.
- `'v3 favorites playlists history and lyrics ids survive the v4 migration'` runs the migration and asserts `favorites`, `playlist_tracks`, `play_history` and `lyrics_cache` values are unchanged.
- `'v4 migration inserts imports before folding cached metadata'` uses a `track_metadata` id equal to the import id and asserts exactly one `tracks` row for that id with `source = 'import'`.
- `'v4 migration folds cached metadata into the matching import row'` asserts the import row has the cached `album`, `genre`, `year`, `trackNumber`, `discNumber`, `artworkUri` and `explicit`, and keeps the stored import `title` and `artist`.
- `'v4 migration leaves unmatched metadata as an unresolved scan seed'` asserts the row is `source = 'scan'`, `location = ''`, `status = 'active'`, `missing = 1`, and the cached tag fields are copied.
- `'v4 migration hides excluded ids and keeps the file state'` asserts `status = 'hidden'` and the row still exists.
- `'v4 migration keeps scan asset ids and import ids verbatim'` asserts `'12345'` and `'import:<hash>'` are untouched.
- `'v4 migration marks a migrated install with legacy storage'` passes `fromVersion: 3` and asserts `storageRootKind = 'legacy'`.
- `'v4 migration leaves a fresh install on the Krotify folder'` passes `fromVersion: 0` and asserts `storageRootKind = 'krotify'`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test tests/tracksMigration.test.ts`
Expected: FAIL because `src/db/migrateV4.ts`, `V4_TABLE_SQL` and the legacy parsers do not exist.

- [ ] **Step 4: Add the v4 schema**

In `src/db/schema.ts`, bump `DB_VERSION` to 4 and add:
```sql
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK(source IN ('scan', 'import', 'download')),
  location TEXT NOT NULL,
  fileName TEXT NOT NULL,
  sizeBytes INTEGER,
  durationMs INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  artist TEXT NOT NULL DEFAULT '',
  album TEXT NOT NULL DEFAULT '',
  albumArtist TEXT,
  trackNumber INTEGER,
  discNumber INTEGER,
  year INTEGER,
  genre TEXT,
  explicit INTEGER,
  artworkUri TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'hidden', 'removed')),
  missing INTEGER NOT NULL DEFAULT 0,
  addedAt INTEGER NOT NULL,
  lastSeenAt INTEGER NOT NULL,
  artworkHue INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS tracks_location_idx ON tracks(location);
CREATE INDEX IF NOT EXISTS tracks_status_idx ON tracks(status);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS track_tags (
  trackId TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  tagId TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(trackId, tagId)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```
Keep `track_metadata`, `playlists`, `playlist_tracks`, `favorites`, `play_history` and `lyrics_cache` as they are. Set `SCHEMA_SQL` to the concatenation of the new `V4_TABLE_SQL` and the existing v1 to v3 DDL.

- [ ] **Step 5: Add the pure legacy parsers**

In `src/db/legacy.ts`, accept only objects with a string `id`, a string `uri` that is non-empty, and `source === 'import'`. Default `title` to `''` and `artist` to `''`; default `durationMs` to `0`; keep `artworkHue` only when finite. Return `[]` for malformed JSON. `parseLegacyExcluded` accepts objects with a string `id`. Never throw.

- [ ] **Step 6: Add the migration function**

In `src/db/migrateV4.ts`:
1. `await db.exec(V4_TABLE_SQL)` first, so the tables exist even though `SCHEMA_SQL` already ran.
2. For each import, insert a row with `id` unchanged, `source = 'import'`, `location = uri`, `fileName` from the URI basename, `sizeBytes = null`, `durationMs`, `title` from the record or `titleFromFilename(fileName)`, `artist`, `status = 'active'`, `missing = fileExists(uri) ? 0 : 1`, `addedAt = now`, `lastSeenAt = now`, `artworkHue = record.artworkHue ?? hueFromSeed(fileName)`. Use `INSERT OR IGNORE` so a re-run cannot duplicate.
3. Read every `track_metadata` row. If `tracks` already has that id with `source = 'import'`, update only `album`, `albumArtist`, `year`, `trackNumber`, `discNumber`, `genre`, `artworkUri` and `explicit` with `COALESCE(tracks.column, ?)` so an existing value wins. Otherwise `INSERT OR IGNORE` a scan seed with `source = 'scan'`, `location = ''`, `fileName = ''`, `durationMs = 0`, cached `title`/`artist`/`album`/`albumArtist`/numbers/genre/artwork/explicit, `status = 'active'`, `missing = 1`, `addedAt = now`, `lastSeenAt = now`, `artworkHue = hueFromSeed(id)`.
4. For each excluded id, `UPDATE tracks SET status = 'hidden' WHERE id = ?`; when no row exists, insert a hidden scan seed with `location = ''`, `missing = 1` and the same defaults.
5. Write `storageRootKind` as `'legacy'` when `fromVersion > 0 && fromVersion < 4`, otherwise `'krotify'`.
6. Return `{ importRows, scanSeeds, hidden }`.

Do not drop `track_metadata`. Do not write AsyncStorage.

- [ ] **Step 7: Add the settings repository**

In `src/db/settings.ts`, `getSetting` returns the `value` or `null`; `putSetting` uses `INSERT OR REPLACE`. Return `null` and no-op when `getDb()` is `null`, matching the existing web behavior.

- [ ] **Step 8: Wire the migration runner**

In `src/db/index.ts`, after `PRAGMA user_version` gives `fromVersion`:
1. If `fromVersion >= 4`, return.
2. Read `krotify.imports.v1` and `krotify.excluded.v1` with `AsyncStorage.getItem` and parse them with the pure parsers. Do this before the transaction.
3. Run the existing `SCHEMA_SQL`, `pendingColumnMigrations` and `pendingPlaylistColumnMigrations` inside the transaction first, so a v1 or v2 install has the v3 columns before the fold.
4. When `fromVersion < 4`, wrap the expo handle as `MigrationDb` (`all: (sql, ...params) => db.getAllAsync(sql, ...params)`, `run: (sql, ...params) => db.runAsync(sql, ...params)`, `exec: (sql) => db.execAsync(sql)`) and call `migrateV3ToV4(adapter, { fromVersion, now: Date.now(), imports, excluded, fileExists })` inside the same transaction. `fileExists` uses `new File(uri).exists` in a `try`/`catch`.
5. Set `PRAGMA user_version = 4` after the transaction succeeds.

Do not delete or rewrite the AsyncStorage keys; they stay read-only for one release.

- [ ] **Step 9: Verify on an upgrade install**

Install over a build with `user_version = 3`. Do not wipe app data. Open Library, Liked Songs, a playlist and Recently played: every track still resolves, no row is duplicated, and the v4 scan seeds are absent from Library. Record the build, device and result for `v5-foundation-device-check.md`. A clean install does not prove the migration.

- [ ] **Step 10: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/db/schema.ts src/db/index.ts src/db/legacy.ts src/db/migrateV4.ts src/db/settings.ts tests/fixtures/v3.ts tests/tracksMigration.test.ts
git commit -m "feat(db): add v4 tracks schema and migration"
```

---

### Task 2: `src/tracks` types, ids and repository

**Files:**
- Create: `src/tracks/types.ts`, `src/tracks/ids.ts`, `src/tracks/rows.ts`, `src/tracks/sql.ts`, `src/tracks/repo.ts`
- Test: `tests/trackIds.test.ts`, `tests/tracks.test.ts`

**Interfaces:**
- Produces: `TrackSource = 'scan' | 'import' | 'download'`.
- Produces: `TrackStatus = 'active' | 'hidden' | 'removed'`.
- Produces: `TrackRecord` with every column from the design, `missing: 0 | 1`.
- Produces: `ScanTrackInput = { id: string; location: string; fileName: string; sizeBytes?: number; durationMs: number }`.
- Produces: `NewOwnedTrack = Omit<TrackRecord, 'id' | 'status' | 'missing' | 'addedAt' | 'lastSeenAt' | 'artworkHue'> & { artworkHue?: number }`.
- Produces: `TrackFieldPatch = Partial<Pick<TrackRecord, 'location' | 'fileName' | 'sizeBytes' | 'durationMs' | 'title' | 'artist' | 'album' | 'albumArtist' | 'trackNumber' | 'discNumber' | 'year' | 'genre' | 'explicit' | 'artworkUri'>>`.
- Produces: `ownedTrackId(uuid?: () => string): string` and `isOwnedId(id: string): boolean`.
- Produces: `scanRow(input: ScanTrackInput, now: number): TrackRecord`, `ownedRow(input: NewOwnedTrack, id: string, now: number): TrackRecord`.
- Produces: `buildTrackUpdate(id: string, patch: TrackFieldPatch): { sql: string; params: (string | number | null)[] }`.
- Produces: `COUNT_BY_STATUS_SQL`, `COUNT_ACTIVE_SCAN_SQL`, `COUNT_ACTIVE_OWNED_SQL` and `TRACK_DEPENDENT_DELETE_SQL: string[]`.
- Produces: `listActiveTracks(): Promise<TrackRecord[]>`, `listHiddenTracks(): Promise<TrackRecord[]>`, `listRemovedOwnedTracks(): Promise<TrackRecord[]>`.
- Produces: `getTrack(id: string): Promise<TrackRecord | null>`.
- Produces: `upsertScanTracks(tracks: ScanTrackInput[], now?: number): Promise<{ insertedIds: string[]; updated: number; missing: number }>`.
- Produces: `insertOwnedTrack(input: NewOwnedTrack): Promise<TrackRecord>`.
- Produces: `updateTrackFields(id: string, patch: TrackFieldPatch): Promise<void>`.
- Produces: `setTrackStatus(id: string, status: TrackStatus): Promise<void>`.
- Produces: `setTrackMissing(id: string, missing: boolean): Promise<void>`.
- Produces: `deleteTrackRecord(id: string): Promise<void>`.
- Produces: `findTrackByLocation(location: string): Promise<TrackRecord | null>`, `findOwnedByKey(fileName: string, sizeBytes: number): Promise<TrackRecord | null>` (owned sources only: `import` and `download`).
- Produces: `countTracks(status: TrackStatus): Promise<number>`, `countActiveScanTracks(): Promise<number>`, `countActiveOwnedTracks(): Promise<number>`.

- [ ] **Step 1: Write the failing id tests**

Add to `tests/trackIds.test.ts`:
```ts
test('owned ids use the own prefix', () => {
  assert.equal(ownedTrackId(() => '00000000-0000-4000-8000-000000000000'), 'own:00000000-0000-4000-8000-000000000000');
});

test('owned ids fall back to a random v4 shape without crypto', () => {
  const id = ownedTrackId(() => 'fallback-shape');
  assert.match(id, /^own:fallback-shape$/);
  assert.equal(isOwnedId(id), true);
});

test('scan and import ids are not owned ids', () => {
  assert.equal(isOwnedId('12345'), false);
  assert.equal(isOwnedId('import:abc'), false);
});
```

- [ ] **Step 2: Write the failing repository SQL tests**

In `tests/tracks.test.ts`, open an in-memory `node:sqlite` database with `PRAGMA foreign_keys = ON`, execute `V4_TABLE_SQL` from `src/db/schema.ts`, and execute the exact `SCAN_UPSERT_SQL`, `SCAN_MISSING_SQL`, `buildTrackUpdate`, count and dependent-delete SQL that the repository uses. Tests:
- `'scan upsert inserts a new row with a filename title'` asserts `source = 'scan'`, `title` from `titleFromFilename`, `status = 'active'`, `missing = 0`.
- `'scan upsert preserves a user edited title and hidden status'` seeds a row with `title = 'Mine'`, `status = 'hidden'`, then upserts the same id with a different filename; asserts title, status and tags are unchanged, and `location`, `fileName` and `lastSeenAt` are updated.
- `'scan upsert clears missing when an asset id returns'` sets `missing = 1`, upserts, asserts `missing = 0`.
- `'scan upsert never revives a removed row'` seeds `status = 'removed'`, upserts, asserts the row is unchanged and no second row exists.
- `'scan upsert marks absent active scan rows missing'` runs `SCAN_MISSING_SQL` with a later timestamp and asserts only untouched active scan rows become `missing = 1`.
- `'scan upsert leaves owned rows untouched'` asserts an import row cannot be marked missing by the scan statement.
- `'track update SQL writes only the provided fields'` asserts `buildTrackUpdate('id', { title: 'New' })` sets `title` and leaves `artist`, `location` and `status` untouched; an empty patch returns an empty assignment list.
- `'count helpers separate active hidden and removed rows'` inserts one of each plus an owned active row and asserts `countTracks`, `countActiveScanTracks` and `countActiveOwnedTracks`.
- `'delete removes dependent rows and keeps other tracks'` inserts favorites, history, lyrics, playlist rows and track tags for two ids; deletes one; asserts only that id's dependents are gone.

Run: `node --test tests/trackIds.test.ts tests/tracks.test.ts`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Add types and id helpers**

Create `src/tracks/types.ts` with the exact fields in the design. `ownedTrackId` uses the injected uuid function, defaulting to `globalThis.crypto?.randomUUID?.()` and otherwise `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` built from `Math.random`. `isOwnedId` tests the `own:` prefix.

- [ ] **Step 4: Add pure row builders**

`scanRow` sets `title: titleFromFilename(fileName)`, `artist: ''`, `album: ''`, optional numbers undefined, `status: 'active'`, `missing: 0`, `addedAt: now`, `lastSeenAt: now`, `artworkHue: hueFromSeed(fileName)`. `ownedRow` takes the seed fields, defaults `title` to `titleFromFilename(fileName)`, `status: 'active'`, `missing: 0`, `artworkHue` to `hueFromSeed(fileName)`.

- [ ] **Step 5: Add the SQL constants**

In `src/tracks/sql.ts`, export the select column list and:
```sql
INSERT INTO tracks (id, source, location, fileName, sizeBytes, durationMs, title, artist, album, albumArtist, trackNumber, discNumber, year, genre, explicit, artworkUri, status, missing, addedAt, lastSeenAt, artworkHue)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  location = excluded.location,
  fileName = excluded.fileName,
  sizeBytes = COALESCE(excluded.sizeBytes, tracks.sizeBytes),
  durationMs = CASE WHEN tracks.durationMs = 0 THEN excluded.durationMs ELSE tracks.durationMs END,
  title = CASE WHEN tracks.title = '' THEN excluded.title ELSE tracks.title END,
  lastSeenAt = excluded.lastSeenAt,
  missing = 0
WHERE tracks.status <> 'removed'
```
and:
```sql
UPDATE tracks SET missing = 1
WHERE source = 'scan' AND status = 'active' AND lastSeenAt < ?
```
`buildTrackUpdate` whitelists keys in this order: `location`, `fileName`, `sizeBytes`, `durationMs`, `title`, `artist`, `album`, `albumArtist`, `trackNumber`, `discNumber`, `year`, `genre`, `explicit`, `artworkUri`. Undefined keys are skipped. Boolean `explicit` becomes `1` or `0`; other values pass through.

Export the count statements and the four dependent deletes as constants so the tests execute the same SQL the repository runs: `DELETE FROM favorites WHERE trackId = ?`, `DELETE FROM play_history WHERE trackId = ?`, `DELETE FROM lyrics_cache WHERE trackId = ?`, `DELETE FROM playlist_tracks WHERE trackId = ?`, in that order, then `DELETE FROM tracks WHERE id = ?`.

- [ ] **Step 6: Implement the repository**

Chunk `upsertScanTracks` at 100 rows. For each chunk, open one `withTransactionAsync`:
1. Query existing ids in the chunk with a placeholder list.
2. Compute `insertedIds` as candidates not present and not matched to a removed row.
3. Run `SCAN_UPSERT_SQL` for every candidate.
4. Count changed rows from `runAsync` results.
After all chunks, run `SCAN_MISSING_SQL` with `now`. Never update `title`, `artist`, `album`, `artworkUri`, `status`, tags or `addedAt` from a scan, except the empty-title fallback in the SQL.

`listActiveTracks` selects `status = 'active' AND location <> ''` ordered by `title` then `id`. `listHiddenTracks` selects `status = 'hidden'`. `listRemovedOwnedTracks` selects `status = 'removed' AND source IN ('import', 'download')`. Map rows with one shared `toRecord` function: `explicit` is `null ? undefined : !== 0`; `missing` stays `0 | 1`.

`insertOwnedTrack` builds the row with `ownedRow(input, ownedTrackId(), Date.now())` and inserts it. `updateTrackFields` returns early on an empty patch. `deleteTrackRecord` runs one transaction: delete `favorites`, `play_history`, `lyrics_cache`, `playlist_tracks` and then `tracks`; `track_tags` cascades. Each function returns `[]`, `null`, `0` or no-ops when `getDb()` is `null`, so the web bundle still loads.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test tests/trackIds.test.ts tests/tracks.test.ts`
Expected: PASS.

- [ ] **Step 8: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/tracks/types.ts src/tracks/ids.ts src/tracks/rows.ts src/tracks/sql.ts src/tracks/repo.ts tests/trackIds.test.ts tests/tracks.test.ts
git commit -m "feat(tracks): add the track repository"
```

---

### Task 3: Read-once metadata seeding and artwork extraction

**Files:**
- Create: `src/tracks/seed.ts`, `src/tracks/seed.web.ts`, `src/tracks/seedMap.ts`
- Test: `tests/seedMap.test.ts`

**Interfaces:**
- Produces: `TrackSeed = { title?: string; artist?: string; album?: string; albumArtist?: string; trackNumber?: number; discNumber?: number; year?: number; genre?: string; artworkUri?: string }`.
- Produces: `readTrackSeed(location: string): Promise<TrackSeed>`.
- Produces: `seedToTrackPatch(seed: TrackSeed, fileName: string): TrackFieldPatch`.
- Keeps: `@missingcore/react-native-metadata-retriever` as the only tag reader. `explicit` is never seeded.

- [ ] **Step 1: Write the failing seed mapping tests**

Add to `tests/seedMap.test.ts`:
- `'seeding prefers embedded tags over the filename'` passes a seed with title, artist, album, albumArtist, numbers, year and genre, and asserts each appears in the patch.
- `'seeding falls back to the filename title'` passes an empty seed for `'03 - Blue Monday.mp3'` and asserts `title: 'Blue Monday'` and no `artist` or `album` keys.
- `'seeding omits artwork when the file has none'` asserts `artworkUri` is absent from the patch, so the repository keeps an existing value.
- `'seeding never sets explicit'` asserts `'explicit' in patch === false`.

Run: `node --test tests/seedMap.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement the pure mapping**

`seedToTrackPatch` trims strings, drops empty strings, keeps finite numbers and passes `artworkUri` only when non-empty. Title is `seed.title?.trim() || titleFromFilename(fileName)`.

- [ ] **Step 3: Implement the native seed reader**

In `src/tracks/seed.ts`, call `getBulkMetadata([location], ['title', 'artist', 'albumTitle', 'albumArtist', 'year', 'trackNumber', 'discNumber', 'genre'])` once. Map `albumTitle` to `album`. Extract embedded art once with `saveHashedArtwork(location, { saveDirectory: new Directory(Paths.document, 'artwork').uri, knownHashes: [] })` after creating the directory; set `artworkUri` to the returned `uri`. Any failure returns the fields that succeeded, never throws.

`src/tracks/seed.web.ts` returns `{}`.

- [ ] **Step 4: Run the unit tests**

Run: `node --test tests/seedMap.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify read-once on device**

Import an MP3 with title, artist, album and embedded art. Confirm the row shows the tags and `artworkUri` points inside the app artwork directory. Edit the title, force-stop, relaunch: the edited title stays and the file artwork does not overwrite it. Import a tagless MP3: the filename title is stored, not an empty title. Record the result in `v5-foundation-device-check.md`.

- [ ] **Step 6: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/tracks/seed.ts src/tracks/seed.web.ts src/tracks/seedMap.ts tests/seedMap.test.ts
git commit -m "feat(tracks): seed tags once on entry"
```

---

## Phase 2: Files

### Task 4: SAF dev-build spike

**Files:**
- Create: `docs/research/v5-saf-spike.md`
- Temporarily modify, then restore: `src/screens/SettingsScreen.tsx`

**Interfaces:**
- Produces: a recorded answer to four questions: does `Directory.pickDirectoryAsync` return a usable directory; do create, write, copy, list and delete work inside it; does `File.downloadFileAsync` accept a SAF destination; does the URI still work after a relaunch.
- Produces: the chosen download path: direct to SAF, or cache then copy.

- [ ] **Step 1: Build and install the dev client**

Run: `npx expo run:android`
Expected: installs and launches. A Metro or Gradle failure stops the spike; record it.

- [ ] **Step 2: Add a temporary `__DEV__` spike action**

Add a temporary button in `SettingsScreen` gated by `__DEV__` that runs the following in order and renders a JSON result on screen:
```ts
const directory = await Directory.pickDirectoryAsync();
const probe = new File(directory, 'krotify-spike.txt');
probe.create({ overwrite: true });
await probe.write('krotify');
const listed = directory.list().map((entry) => entry.name);
const copySource = new File(Paths.cache, 'krotify-spike-source.txt');
copySource.create({ overwrite: true });
await copySource.write('copy');
const copyTarget = new File(directory, 'krotify-spike-copy.txt');
await copySource.copy(copyTarget);
const copySize = copyTarget.size;
copyTarget.delete();
probe.delete();
return { uri: directory.uri, listed, copySize };
```
Also record `directory.uri` in the screen so it can be pasted into the evidence doc.

- [ ] **Step 3: Prove download into a picked folder**

Serve a local file so no third-party URL is involved:
```bash
mkdir -p /tmp/opencode/saf-spike
dd if=/dev/urandom of=/tmp/opencode/saf-spike/spike.bin bs=1024 count=16
npx --yes serve -l 8080 /tmp/opencode/saf-spike
```
Find the dev machine LAN address with `ip route get 1.1.1.1` and use `http://<LAN-IP>:8080/spike.bin` on the device. Try `File.downloadFileAsync(url, new File(directory, 'spike.bin'), { signal: new AbortController().signal })` first. If it rejects or writes zero bytes, download to `Paths.cache` and copy into the directory, then record that the fallback is required. Confirm the downloaded size is 16384 bytes in both paths.

- [ ] **Step 4: Prove persistence across relaunch**

Store the picked `directory.uri` in the temporary screen state and in `AsyncStorage` under a spike-only key. Kill and relaunch the app, read the key, construct `new Directory(uri)` and list it. If the URI is unreadable or empty after relaunch, record the exact failure and take a persistable grant through the legacy `StorageAccessFramework.requestDirectoryPermissionsAsync()` path, or a native `takePersistableUriPermission` if the legacy helper also fails to persist. Re-run the relaunch check with that path. Do not drop the picked-root setting: if both APIs fail on the device, stop and report the exact failure so a small native storage helper can be planned.

- [ ] **Step 5: Record the spike**

Write `docs/research/v5-saf-spike.md` with device model, Android version, build, each operation and its result, the exact URI shape, the download path that worked and the persistence answer. A row is not a pass without the observed output.

- [ ] **Step 6: Remove the temporary code**

Delete the spike button and the spike-only key. Run `git diff` to confirm only the evidence doc remains changed. If the code is not removed, the task is not done.

- [ ] **Step 7: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add docs/research/v5-saf-spike.md
git commit -m "docs: record the v5 SAF spike"
```

---

### Task 5: Storage root module

**Files:**
- Create: `src/storage/types.ts`, `src/storage/names.ts`, `src/storage/root.ts`, `src/storage/store.ts`
- Test: `tests/storageNames.test.ts`

**Interfaces:**
- Produces: `StorageRoot = { uri: string; name: string; kind: 'app' | 'picked' }`.
- Produces: `splitExtension(name: string): { stem: string; ext: string }`.
- Produces: `withCollisionSuffix(name: string, index: number): string`.
- Produces: `uniqueFileName(name: string, taken: ReadonlySet<string>): string`.
- Produces: `getStorageRoot(): Promise<StorageRoot>`.
- Produces: `chooseStorageRoot(): Promise<StorageRoot | null>`.
- Produces: `setStorageRoot(root: StorageRoot): Promise<void>`.
- Produces: `listOwnedFiles(root: StorageRoot): Promise<File[]>`.
- Produces: `moveOwnedFiles(to: StorageRoot): Promise<{ moved: number; failures: { name: string; reason: string }[] }>`.
- Produces: `storageInfo(): Promise<{ root: StorageRoot; fileCount: number; totalBytes: number; reclaimableBytes: number }>`.
- Produces: `cleanRemovedOwnedFiles(): Promise<{ deleted: number; bytes: number }>`.
- Produces: `deleteOwnedFile(location: string): Promise<void>`.
- Produces: `storeOwnedFile(sourceUri: string, fileName: string, root?: StorageRoot): Promise<File>`.
- Produces: `downloadOwnedFile(url: string, fileName: string, options?: { signal?: AbortSignal }): Promise<File>`.
- Consumes: `getSetting`, `putSetting`, `listRemovedOwnedTracks`, `findTrackByLocation`, `updateTrackFields`, `deleteTrackRecord`.

- [ ] **Step 1: Write the failing collision tests**

Add to `tests/storageNames.test.ts`:
- `'a free name is unchanged'` asserts `uniqueFileName('Song.mp3', new Set()) === 'Song.mp3'`.
- `'a collision adds a space and a number before the extension'` asserts `withCollisionSuffix('Song.mp3', 2) === 'Song (2).mp3'`.
- `'repeated collisions keep increasing'` asserts `uniqueFileName('Song.mp3', new Set(['Song.mp3', 'Song (2).mp3'])) === 'Song (3).mp3'`.
- `'an existing suffix does not confuse the next free name'` asserts `uniqueFileName('Song (2).mp3', new Set(['Song.mp3'])) === 'Song (2).mp3'`.
- `'a name without an extension still gets a suffix'` asserts `withCollisionSuffix('track', 3) === 'track (3)'`.
- `'a hidden extension is preserved'` asserts `withCollisionSuffix('.nomedia', 2) === '.nomedia (2)'`.

Run: `node --test tests/storageNames.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement the pure name helpers**

`splitExtension` treats a leading dot as a hidden filename, not an extension. `uniqueFileName` strips an existing ` (N)` suffix from the stem, then returns the first free name starting at `(2)` when the unsuffixed name is taken.

- [ ] **Step 3: Implement root selection**

`getStorageRoot` reads `storageRootUri`, `storageRootName` and `storageRootKind` from settings. When a URI exists, return it. Otherwise create `new Directory(Paths.document, kind === 'legacy' ? 'imports' : 'Krotify')` with `{ idempotent: true, intermediates: true }`, persist all three keys and return `{ uri, name, kind: 'app' }`. Default `kind` to `'krotify'`.

`chooseStorageRoot` calls `Directory.pickDirectoryAsync()`. Treat a thrown cancellation as `null`. On success persist `storageRootUri`, `storageRootName` and `storageRootKind = 'picked'`.

- [ ] **Step 4: Implement storage operations**

`storeOwnedFile` lists the root names, picks `uniqueFileName`, copies `new File(sourceUri)` to `new File(root, name)` and returns the destination. Never rename after this point.

`downloadOwnedFile` calls `File.downloadFileAsync(url, destination, { signal })`. On failure, download to `new File(Paths.cache, 'download-' + Date.now())`, then `storeOwnedFile` into the root, then delete the cache file and any partial SAF file. Keep the fallback even when the spike proves direct SAF downloads.

`moveOwnedFiles` flattens the old root: move top-level files, then move files from each one-level subdirectory (the legacy `imports/<stamp>/<name>` shape), then delete empty subdirectories. On a name collision use `uniqueFileName`. After each successful move, `findTrackByLocation(oldUri)` and `updateTrackFields(id, { location: newUri, fileName })`. Scan tracks are never moved; only files physically under the old root are touched. Return per-file failures and continue.

`storageInfo` returns the root, and counts only files physically present under it for `fileCount` and `totalBytes`. `reclaimableBytes` sums `new File(row.location).size` for `listRemovedOwnedTracks()` rows whose file exists. `cleanRemovedOwnedFiles` deletes those files, then `deleteTrackRecord(id)` and reports the bytes.

`deleteOwnedFile` does nothing when the file is absent and never deletes a directory.

- [ ] **Step 5: Run the tests**

Run: `node --test tests/storageNames.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify on device**

On the dev build: confirm the default root is `Krotify` on a clean install and `imports` after an upgrade. Choose a public Downloads folder through SAF, confirm the picker returns, then import a file and confirm it appears in the system file manager. Move existing files from `imports` and confirm the legacy subfolders are flattened, the DB rows update, and the moved files still play. Record results.

- [ ] **Step 7: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/storage/types.ts src/storage/names.ts src/storage/root.ts src/storage/store.ts tests/storageNames.test.ts
git commit -m "feat(storage): add the chosen storage root"
```

---

### Task 6: Rewrite local import, drop in-place tag writing, load AppShell from the repo

**Files:**
- Create: `src/imports/plan.ts`, `src/imports/local.ts`, `src/imports/local.web.ts`, `src/lib/artworkInput.ts`, `src/tracks/editPatch.ts`, `src/tracks/view.ts`
- Delete: `src/library/imports.ts`, `src/library/imports.web.ts`, `src/library/exclusions.ts`, `src/library/tagWriter.ts`, `src/lib/tagPatch.ts`, `modules/audio-tags/`, `tests/tagWriter.test.ts`, `tests/tagPatch.test.ts`
- Modify: `src/AppShell.tsx`, `src/screens/EditTrackScreen.tsx`, `src/screens/ImportScreen.tsx`, `src/library/playlistArtwork.ts`, `src/types.ts`
- Test: `tests/importPlan.test.ts`, `tests/editPatch.test.ts`

**Interfaces:**
- Produces in `src/imports/plan.ts`: `ImportFailure = { name: string; reason: 'unsupported' | 'no audio data' | 'copy failed' }`.
- Produces in `src/imports/plan.ts`: `ImportSkip = { name: string; reason: 'duplicate' | 'hidden' }`.
- Produces in `src/imports/plan.ts`: `ImportResult = { added: TrackRecord[]; skipped: ImportSkip[]; failures: ImportFailure[] }`.
- Produces: `copyIsUsable(bytes: number | null | undefined): boolean` — true only for a finite value greater than zero.
- Produces: `ImportCandidate = Pick<TrackRecord, 'id' | 'status' | 'fileName' | 'sizeBytes' | 'location'>`.
- Produces: `decideImport(existing: ImportCandidate[], key: { fileName: string; sizeBytes: number }, fileExists: (location: string) => boolean): ImportDecision`, where `ImportDecision = { kind: 'insert' } | { kind: 'reactivate'; id: string; reuseFile: boolean } | { kind: 'duplicate'; id: string } | { kind: 'hidden'; id: string }`.
- Produces: `pickAndImportTracks(): Promise<ImportResult>`.
- Produces: `validateArtworkInput(input: ArtworkInput): { ok: true } | { ok: false; errors: string[] }` and `MAX_ARTWORK_BYTES`.
- Produces: `EditForm = { title: string; artist: string; album: string; albumArtist: string; genre: string; trackNumber: string; discNumber: string; year: string }`.
- Produces: `buildTrackFieldPatch(track: TrackRecord, form: EditForm, renameOnly: boolean): { patch: TrackFieldPatch; error?: string }`.
- Produces: `toUiTrack(record: TrackRecord): Track`, with `Track.missing: 0 | 1` added to `src/types.ts` and copied by the adapter. Later plans depend on that field.
- Changes: `EditTrackScreen.save` calls `updateTrackFields`; the access check, `needsCopy`, `applyTagEdit` and `importTrackCopy` paths are gone.
- Changes: `AppShell` loads active and hidden rows from `listActiveTracks` and `listHiddenTracks`; hide, restore, exclude all and delete use `setTrackStatus`, `deleteOwnedFile` and `deleteTrackRecord`.
- Produces in `AppShell`: `refreshLibraryFromDb(): Promise<void>` reads active and hidden rows and replaces both UI lists.

- [ ] **Step 1: Write the failing import decision tests**

Add to `tests/importPlan.test.ts`:
- `'copy validation only rejects zero bytes'` asserts `copyIsUsable(0)`, `null` and `undefined` are false, and `copyIsUsable(1)`, `copyIsUsable(4096)` are true.
- `'a new name and size is an insert'` passes no candidates.
- `'an active row with the same name and size is a duplicate'`.
- `'a removed row is reactivated and keeps its file when it exists'` asserts `{ kind: 'reactivate', reuseFile: true }`.
- `'a removed row is reactivated into the new copy when its file is gone'` asserts `reuseFile: false`.
- `'a hidden row stays hidden and is reported as skipped'`.

Add to `tests/editPatch.test.ts`:
- `'rename patches only the title'`
- `'an empty title is rejected'`
- `'unchanged fields are omitted'`
- `'artwork validation accepts an image under the limit'`
- `'artwork validation rejects a non image MIME'`
- `'artwork validation rejects a file over ten megabytes'`

Run: `node --test tests/importPlan.test.ts tests/editPatch.test.ts`
Expected: FAIL because the modules do not exist.

- [ ] **Step 2: Implement the pure import plan**

`copyIsUsable` is only a zero check. `decideImport` matches by exact `fileName` and `sizeBytes`; active returns `duplicate`, hidden returns `hidden`, removed returns `reactivate` with `reuseFile = fileExists(candidate.location)`. The provider-reported size is not an input anywhere.

- [ ] **Step 3: Implement the import module**

`pickAndImportTracks`:
1. `DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true, copyToCacheDirectory: true })`; return empty on cancel.
2. Resolve `name` with `importedFileName(asset.name, 'track-' + (index + 1) + '.mp3', asset.mimeType)`. Reject a non-audio MIME other than `application/octet-stream` as `unsupported`.
3. Read `sourceSize` from `new File(asset.uri).size`. Do not use `asset.size`. If it is not a finite value greater than zero, record `no audio data` and continue.
4. `const existing = await findOwnedByKey(name, sourceSize)`; call `decideImport(existing ? [existing] : [], { fileName: name, sizeBytes: sourceSize }, (location) => new File(location).exists)`.
5. On `duplicate` or `hidden`, push `{ name, reason }` to `skipped` and continue without copying.
6. On `reactivate` with `reuseFile`, call `updateTrackFields(id, { location: existing.location, fileName: name, sizeBytes: sourceSize })`, then `setTrackMissing(id, false)`, `setTrackStatus(id, 'active')`, push the refreshed `getTrack(id)` to `added`, and continue without copying.
7. For `insert` or `reactivate` without a usable file, copy with `storeOwnedFile`. Require `copyIsUsable(file.size)`; on failure delete the copy, record `no audio data` and continue. Never record `copy failed` because of a size comparison.
8. Probe duration with the existing `createAudioPlayer` pattern, 2000 ms timeout, `0` on timeout. Never fail an import because the probe timed out.
9. Read the seed once with `readTrackSeed(file.uri)` and build `seedToTrackPatch(seed, name)`. On `reactivate`, `updateTrackFields(id, { ...patch, location: file.uri, fileName: file.name, sizeBytes: file.size, durationMs })`, then `setTrackMissing(id, false)` and `setTrackStatus(id, 'active')`, then push `getTrack(id)`. On `insert`, `insertOwnedTrack` with `title: patch.title ?? titleFromFilename(name)`, `artist: patch.artist ?? ''`, `album: patch.album ?? ''`, the other patch fields, `location = file.uri`, `fileName = file.name`, `sizeBytes = file.size`, `durationMs` and `source = 'import'`.
10. Return `{ added, skipped, failures }`. Delete partial copies on any thrown error and continue with the next asset.

`src/imports/local.web.ts` returns `{ added: [], skipped: [], failures: [] }`.

- [ ] **Step 4: Implement the edit patch module**

Move `MAX_ARTWORK_BYTES`, `ArtworkInput` and the MIME and size checks from `src/lib/tagPatch.ts` to `src/lib/artworkInput.ts`. Keep `playlistArtwork.ts` working by changing its import only. `buildTrackFieldPatch` mirrors the existing form logic, returns numbers for the number fields and omits unchanged keys.

- [ ] **Step 5: Convert `EditTrackScreen` to DB writes**

Remove `initialAccess`, `AccessState`, the write-access effect, `importCopy`, `needsCopy`, `applyTagEdit`, `TagWriteError` and the read-only branch. Keep the form, details mode, artwork picker and busy state. `save` builds the patch, adds `artworkUri` when artwork was picked, calls `updateTrackFields(track.id, patch)` and `onSaved({ ...track, ...patch })`. A save failure shows `Could not save changes.` Details mode stays read-only without an access check.

- [ ] **Step 6: Delete the in-place tag writer**

Delete the files listed above. Confirm:
```bash
git grep -n "audio-tags\|tagWriter\|tagPatch\|importTrackCopy\|library/imports\|library/exclusions"
```
Expected: no hits outside deleted files and no `.worktrees` paths. `src/screens/ImportScreen.tsx` imports `ImportFailure` from `src/imports/plan` instead, so the type does not depend on a platform file.

- [ ] **Step 7: Rewire AppShell load and status transitions**

Keep `Track[]` state. Replace `loadImportedTracks` and `loadExcludedTracks` with `listActiveTracks()` and `listHiddenTracks()`, mapping each record through `toUiTrack`. Add `missing: 0 | 1` to the UI `Track` type. `toUiTrack` maps `source: 'download'` to `'import'` for the current UI, `uri: record.location` and `missing: record.missing`.

Replace `excludeTrack`, `excludeTracks`, `restoreTrack`, `clearExcludedTracks` with:
- hide: `setTrackStatus(id, 'hidden')`, `refreshLibraryFromDb()`, remove from queue.
- restore: `setTrackStatus(id, 'active')`, `refreshLibraryFromDb()`.
- exclude all: `setTrackStatus` for every active scan row, `refreshLibraryFromDb()`, remove from queue.
- delete: keep the existing confirmation, delete the MediaStore asset for scans, `deleteOwnedFile(record.location)` for owned rows, then `deleteTrackRecord(id)` and `refreshLibraryFromDb()`.

Keep the existing `scanLibrary()` call and map `result.tracks` for display until Task 7 replaces it with an upsert. Do not persist scan results yet. A scan track hidden in this intermediate commit has no `tracks` row, so the hide is a no-op until Task 7 persists scans; do not claim scan hide or restore works before Task 7.

Remove the `enrichTracks` and `hydrateArtwork` calls and imports from the load and import paths, and remove any now-unused imports so lint stays clean. New scan tracks show filename titles until Task 7 adds seeding. `handleImport` consumes `{ added, skipped, failures }`, merges `added.map(toUiTrack)`, sets failures, reports skipped only as a status note, and switches to Library after a successful add. Keep the existing Import screen layout.

- [ ] **Step 8: Run the unit tests**

Run: `node --test tests/importPlan.test.ts tests/editPatch.test.ts`
Expected: PASS.

- [ ] **Step 9: Verify on device**

Import a set that includes the MP3 that used to report `copy failed`; every non-zero file must import, show its real title and play after a cold relaunch. Import a 0-byte provider copy: it is reported as `no audio data`. Import the same file twice: the second is skipped, not duplicated. Rename, change artist and album, and change artwork on a scanned file and an imported file: each saves instantly, survives relaunch, and the file bytes and filename are unchanged. Clear an owned track, re-import the same name and size: the row reactivates and no second file appears. Delete a track: the confirmation names it. Record results.

- [ ] **Step 10: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/imports src/lib/artworkInput.ts src/tracks/editPatch.ts src/tracks/view.ts src/AppShell.tsx src/screens/EditTrackScreen.tsx src/screens/ImportScreen.tsx src/library/playlistArtwork.ts tests/importPlan.test.ts tests/editPatch.test.ts
git add -u src/library/imports.ts src/library/imports.web.ts src/library/exclusions.ts src/library/tagWriter.ts src/lib/tagPatch.ts modules/audio-tags tests/tagWriter.test.ts tests/tagPatch.test.ts
git commit -m "feat(import): copy into the owned root and edit in the db"
```

---

## Phase 3: Scan and wiring

### Task 7: Scan upsert, owned-root exclusion and scan summary

**Files:**
- Create: `src/tracks/scanPlan.ts`, `src/tracks/scanSync.ts`
- Modify: `src/library/scan.ts`, `src/AppShell.tsx`, `src/db/settings.ts`
- Test: `tests/scanPlan.test.ts`, `tests/settings.test.ts`

**Interfaces:**
- Produces: `ownedKey(fileName: string, sizeBytes: number | undefined): string | null`.
- Produces: `filterScanCandidates(candidates: ScanTrackInput[], options: { rootUri: string | null; ownedKeys: ReadonlySet<string> }): { accepted: ScanTrackInput[]; skippedOwned: number }`.
- Produces: `ScanSummary = { lastScanAt: number; found: number; newTracks: number; missing: number }`.
- Produces: `parseScanSummary(values: Record<string, string | null>): ScanSummary | null`.
- Produces: `getScanSummary(): Promise<ScanSummary | null>` and `putScanSummary(summary: ScanSummary): Promise<void>`.
- Produces: `syncScanResults(candidates: ScanTrackInput[], options: { rootUri: string | null }): Promise<{ summary: ScanSummary; skippedOwned: number }>`; it loads owned rows itself.
- Changes: `scanLibrary()` returns `{ candidates: ScanTrackInput[]; assets: Map<string, Asset> }`; it resolves the URI and the byte size for each asset and keeps the existing system-audio and duration filters.

- [ ] **Step 1: Write the failing scan plan tests**

Add to `tests/scanPlan.test.ts`:
- `'an asset under the app owned root is skipped by path prefix'` uses `rootUri: 'file:///storage/emulated/0/Music/Krotify'` and an asset under it.
- `'a content uri root falls back to name and size'` uses `rootUri: 'content://...'` and an asset with a matching `ownedKey`.
- `'an owned name and size is skipped even without a prefix match'` covers a public folder whose asset URI does not share the root prefix.
- `'a scan asset outside the root is kept'`.
- `'an asset with no size cannot match the fallback and is kept'`.

Add to `tests/settings.test.ts`:
- `'scan summary is null before the first scan'`
- `'scan summary parses stored values'`
- `'scan summary rejects a partial row'`

Run: `node --test tests/scanPlan.test.ts tests/settings.test.ts`
Expected: FAIL because the modules do not exist.

- [ ] **Step 2: Implement the scan filter**

`ownedKey` returns `null` unless `fileName` is non-empty and `sizeBytes` is a positive finite number, otherwise `fileName + ':' + sizeBytes`. `filterScanCandidates` skips a candidate when a `file://` root prefix matches its `location`, or when its `ownedKey` is in `ownedKeys`. Count skips.

- [ ] **Step 3: Extend scan collection**

In `src/library/scan.ts`, keep the paged MediaStore query, `systemAssetIds`, `shouldIncludeAudio`, URI resolution and the asset map. Add `sizeBytes` from `new File(uri).size` in a `try`/`catch`; omit it when unavailable. Build `ScanTrackInput` directly. Remove the `tracksFromPage` use from this path.

- [ ] **Step 4: Implement scan sync**

`syncScanResults`:
1. Load `listActiveTracks()` and `listRemovedOwnedTracks()`, keep records whose `source` is `import` or `download`, and build `ownedKeys` from `ownedKey(fileName, sizeBytes)`.
2. `filterScanCandidates(candidates, { rootUri, ownedKeys })`.
3. `const { insertedIds, updated, missing } = await upsertScanTracks(accepted)`.
4. For each inserted id, `getTrack(id)` and `readTrackSeed(location)`, then `updateTrackFields(id, seedToTrackPatch(seed, fileName))`. Limit concurrency to 2 and never block on a failed seed.
5. `summary = { lastScanAt: now, found: candidates.length, newTracks: insertedIds.length, missing }`; `putScanSummary(summary)`.
6. Return `{ summary, skippedOwned }`.

- [ ] **Step 5: Add the summary helpers**

Add `parseScanSummary`, `getScanSummary` and `putScanSummary` to `src/db/settings.ts`. Store `scan.lastScanAt`, `scan.found`, `scan.new` and `scan.missing` as strings. A missing or non-finite key makes the whole summary `null`.

- [ ] **Step 6: Wire the scan into AppShell**

When scan is enabled and permission is granted: `const result = await scanLibrary()`, store `assetsRef`, then `await syncScanResults(result.candidates, { rootUri: (await getStorageRoot()).uri })`. Re-read `listActiveTracks()` and `listHiddenTracks()` and map through `toUiTrack`. When scan is off or permission is denied, do not call `syncScanResults` and do not mark anything missing; load only active DB rows, which excludes unresolved seeds.

A skipped-owned candidate whose asset already has a scan row is left untouched by `SCAN_UPSERT_SQL` and is marked `missing = 1` by `SCAN_MISSING_SQL`. That preserves the row and its tags, but Library can then show a missing scan row beside the owned copy. Do not auto-remove or auto-hide it in this task; record the observation for the Library UI plan rather than inventing a status transition the user did not ask for.

Do not add library UI. `SettingsScreen` continues to receive the existing props for now; the last scan summary is written to settings for a later Settings task.

- [ ] **Step 7: Verify on device**

Pick a public Music folder as the storage root, import a file there, then rescan: the owned copy appears once, and the scan reports it as skipped. Hide a scan track, rescan: it stays hidden. Clear a scan track, rescan: it does not return. Delete a scan file outside the app, rescan: the row is `missing = 1`, not deleted. Turn scanning off and relaunch: unresolved migration seeds do not appear. Rescan again with the file restored under the same asset id: `missing` clears. Record results.

- [ ] **Step 8: Run the tests and the full check**

Run: `node --test tests/scanPlan.test.ts tests/settings.test.ts`
Expected: PASS.

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add src/tracks/scanPlan.ts src/tracks/scanSync.ts src/library/scan.ts src/AppShell.tsx src/db/settings.ts tests/scanPlan.test.ts tests/settings.test.ts
git commit -m "feat(scan): upsert scans into the track store"
```

---

### Task 8: Foundation device verification and closeout

**Files:**
- Create: `docs/research/v5-foundation-device-check.md`
- Modify: only files required by failures found in this task

- [ ] **Step 1: Run the foundation matrix on a real Android device**

Record pass or fail with evidence for each:
- Upgrade install from a v3 build: favorites, playlists, history, lyrics, resume and artwork still resolve by id.
- Clean install: default root `Krotify`; upgrade install: default root `imports`.
- Import from Files, Downloads, Google Drive and an SD card if present.
- Import the previously failing MP3: it imports and plays.
- Import a 0-byte provider copy: reported, not listed.
- Import the same file twice: skipped, not duplicated.
- Rename, retag, change artist, album and artwork on a scanned and an imported file: saves, survives relaunch, file bytes and filename unchanged.
- Clear an owned track then re-import the same name and size: reactivates, no duplicate.
- Delete: confirmation names the track; the file is gone only for owned rows.
- Storage: change folder, move existing files, flatten legacy subfolders, storage counts and reclaimable bytes.
- Scan with the root inside a scanned public folder: no duplicate owned track.
- Scan off or permission denied: unresolved seeds stay hidden and nothing is marked missing.
- Missing owned file: row survives, playback of another track still works, rescan does not delete it.

- [ ] **Step 2: Record failures with logcat**

For anything that fails, capture `adb logcat -b crash` and the relevant normal log slice. Link the trace in the evidence doc. Never record an untested pass. If the picked root does not survive relaunch, switch to the persistable-grant path from Task 4 before marking the storage feature complete.

- [ ] **Step 3: Capture remaining risk in the evidence doc**

List anything still unproven, with the exact next action. At minimum, carry forward: SAF cancel behavior, MediaStore byte size availability on a SAF root, and expo-sqlite versus `node:sqlite` migration parity.

- [ ] **Step 4: Run the full check and commit**

Run: `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`

```bash
git add docs/research/v5-foundation-device-check.md
git commit -m "docs: record v5 foundation device checks"
```

---

## Acceptance

- `user_version = 4` on a clean install and after an upgrade; favorites, playlists, history, lyrics and resume ids resolve unchanged.
- `tracks` is the only active track store; `track_metadata` is folded and unused, and the AsyncStorage import and exclusion lists are read once and never written.
- Scan and import ids never change; new owned files use `own:<uuid>`; removed ids are tombstones.
- A local import copies once into the chosen root, never fails on a size mismatch, dedupes by name and size, reactivates a removed row, seeds tags once and returns `{ added, skipped, failures }`.
- Edits are DB writes that survive relaunch and leave the file untouched.
- The storage root is real: default per install, changeable through the system picker, flat layout with ` (2)`/` (3)` suffixes, and move flattens legacy subfolders.
- Scan upserts by asset id, preserves overrides, status and tags, marks absent rows missing, never re-adds removed rows and skips owned files.
- Every task ends with `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`.
- Every device claim in `v5-saf-spike.md` and `v5-foundation-device-check.md` has recorded evidence.
