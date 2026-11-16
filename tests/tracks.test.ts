import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { V4_TABLE_SQL } from '../src/db/schema.ts';
import { titleFromFilename } from '../src/lib/format.ts';
import { hueFromSeed } from '../src/lib/hash.ts';
import { createTrackRepo, type TrackDb } from '../src/tracks/repo.ts';
import { scanRow } from '../src/tracks/rows.ts';
import {
  COUNT_ACTIVE_OWNED_SQL,
  COUNT_ACTIVE_SCAN_SQL,
  COUNT_BY_STATUS_SQL,
  DELETE_TRACK_SQL,
  SCAN_MISSING_SQL,
  SCAN_UPSERT_SQL,
  TRACK_DEPENDENT_DELETE_SQL,
  buildTrackUpdate,
  scanUpsertParams,
} from '../src/tracks/sql.ts';
import type { ScanTrackInput } from '../src/tracks/types.ts';

type StoredTrack = {
  id: string;
  source: string;
  location: string;
  fileName: string;
  sizeBytes: number | null;
  durationMs: number;
  title: string;
  artist: string;
  album: string;
  albumArtist: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  year: number | null;
  genre: string | null;
  explicit: number | null;
  artworkUri: string | null;
  status: string;
  missing: number;
  addedAt: number;
  lastSeenAt: number;
  artworkHue: number;
};

const DEPENDENT_TABLE_SQL = `
  CREATE TABLE playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    description TEXT,
    artworkUri TEXT
  );
  CREATE TABLE playlist_tracks (
    playlistId TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    trackId TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY(playlistId, trackId)
  );
  CREATE TABLE favorites (
    trackId TEXT PRIMARY KEY,
    addedAt INTEGER NOT NULL
  );
  CREATE TABLE play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trackId TEXT NOT NULL,
    playedAt INTEGER NOT NULL
  );
  CREATE TABLE lyrics_cache (
    trackId TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    text TEXT,
    fetchedAt INTEGER NOT NULL
  );
`;

function createDb(): DatabaseSync {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  raw.exec(V4_TABLE_SQL);
  raw.exec(DEPENDENT_TABLE_SQL);
  return raw;
}

function input(id: string, fileName: string, overrides: Partial<ScanTrackInput> = {}): ScanTrackInput {
  return {
    id,
    location: `file:///music/${fileName}`,
    fileName,
    durationMs: 1_000,
    ...overrides,
  };
}

function upsert(
  raw: DatabaseSync,
  track: ScanTrackInput,
  now = 1_000,
): { changes: number; row: ReturnType<typeof scanRow> } {
  const row = scanRow(track, now);
  const result = raw.prepare(SCAN_UPSERT_SQL).run(...scanUpsertParams(row));
  return { changes: Number(result.changes), row };
}

function insertOwned(
  raw: DatabaseSync,
  id: string,
  source: 'import' | 'download',
  fileName: string,
  lastSeenAt = 1_000,
  sizeBytes: number | null = null,
): void {
  raw
    .prepare(
      `INSERT INTO tracks
         (id, source, location, fileName, sizeBytes, durationMs, title, artist, album,
          status, missing, addedAt, lastSeenAt, artworkHue)
       VALUES (?, ?, ?, ?, ?, 0, ?, '', '', 'active', 0, ?, ?, 0)`,
    )
    .run(
      id,
      source,
      `file:///owned/${fileName}`,
      fileName,
      sizeBytes,
      fileName,
      lastSeenAt,
      lastSeenAt,
    );
}

function stored(raw: DatabaseSync, id: string): StoredTrack | undefined {
  const row = raw.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as StoredTrack | undefined;
  return row ? { ...row } : undefined;
}

function count(raw: DatabaseSync, sql: string, ...params: (string | number)[]): number {
  const row = raw.prepare(sql).get(...params) as { count: number };
  return Number(row.count);
}

function tags(raw: DatabaseSync, id: string): string[] {
  return (
    raw
      .prepare(
        `SELECT tagId FROM track_tags WHERE trackId = ? ORDER BY tagId`,
      )
      .all(id) as { tagId: string }[]
  ).map((row) => row.tagId);
}

function repoDb(raw: DatabaseSync): {
  db: TrackDb;
  transactions: () => number;
  runs: () => string[];
} {
  let transactionCount = 0;
  const runs: string[] = [];
  const db: TrackDb = {
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) =>
      raw.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T>(sql: string, ...params: (string | number | null)[]) => {
      const row = raw.prepare(sql).get(...params);
      return row === undefined ? null : ({ ...row } as T);
    },
    runAsync: async (sql, ...params) => {
      runs.push(sql);
      return { changes: Number(raw.prepare(sql).run(...params).changes) };
    },
    withTransactionAsync: async (task) => {
      transactionCount += 1;
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { db, transactions: () => transactionCount, runs: () => runs };
}

test('scan upsert inserts a new row with a filename title', () => {
  const raw = createDb();
  const { changes, row } = upsert(raw, input('1', '01 - Song.mp3'), 500);

  assert.equal(changes, 1);
  const track = stored(raw, '1');
  assert.ok(track);
  assert.equal(track.source, 'scan');
  assert.equal(track.title, titleFromFilename('01 - Song.mp3'));
  assert.equal(track.status, 'active');
  assert.equal(track.missing, 0);
  assert.equal(track.addedAt, 500);
  assert.equal(track.lastSeenAt, 500);
  assert.equal(track.artworkHue, row.artworkHue);
});

test('scan upsert preserves a user edited title and hidden status', () => {
  const raw = createDb();
  upsert(raw, input('1', 'old.mp3'), 100);
  raw.prepare("UPDATE tracks SET title = 'Mine', status = 'hidden' WHERE id = '1'").run();
  raw.prepare("INSERT INTO tags (id, name, createdAt) VALUES ('t1', 'Road', 1)").run();
  raw.prepare("INSERT INTO track_tags (trackId, tagId) VALUES ('1', 't1')").run();

  upsert(raw, input('1', 'new.mp3'), 200);

  const track = stored(raw, '1');
  assert.ok(track);
  assert.equal(track.title, 'Mine');
  assert.equal(track.status, 'hidden');
  assert.deepEqual(tags(raw, '1'), ['t1']);
  assert.equal(track.location, 'file:///music/new.mp3');
  assert.equal(track.fileName, 'new.mp3');
  assert.equal(track.lastSeenAt, 200);
  assert.equal(track.addedAt, 100);
});

test('scan upsert clears missing when an asset id returns', () => {
  const raw = createDb();
  upsert(raw, input('1', 'song.mp3'), 100);
  raw.prepare("UPDATE tracks SET missing = 1 WHERE id = '1'").run();

  upsert(raw, input('1', 'song.mp3'), 200);

  assert.equal(stored(raw, '1')?.missing, 0);
});

test('scan upsert never revives a removed row', () => {
  const raw = createDb();
  upsert(raw, input('1', 'old.mp3'), 100);
  raw
    .prepare(
      "UPDATE tracks SET status = 'removed', title = 'Gone', location = 'file:///old', fileName = 'old.mp3', lastSeenAt = 100 WHERE id = '1'",
    )
    .run();

  const { changes } = upsert(raw, input('1', 'new.mp3'), 500);

  assert.equal(changes, 0);
  const track = stored(raw, '1');
  assert.ok(track);
  assert.equal(track.status, 'removed');
  assert.equal(track.title, 'Gone');
  assert.equal(track.location, 'file:///old');
  assert.equal(track.fileName, 'old.mp3');
  assert.equal(track.lastSeenAt, 100);
  assert.equal(count(raw, 'SELECT COUNT(*) AS count FROM tracks'), 1);
});

test('scan upsert marks absent active scan rows missing', () => {
  const raw = createDb();
  upsert(raw, input('1', 'one.mp3'), 100);
  upsert(raw, input('2', 'two.mp3'), 200);
  upsert(raw, input('3', 'three.mp3'), 100);
  raw.prepare("UPDATE tracks SET status = 'hidden' WHERE id = '3'").run();

  const result = raw.prepare(SCAN_MISSING_SQL).run(150);

  assert.equal(Number(result.changes), 1);
  assert.equal(stored(raw, '1')?.missing, 1);
  assert.equal(stored(raw, '2')?.missing, 0);
  assert.equal(stored(raw, '3')?.missing, 0);
});

test('scan upsert leaves owned rows untouched', () => {
  const raw = createDb();
  insertOwned(raw, 'import:1', 'import', 'song.mp3', 100);

  raw.prepare(SCAN_MISSING_SQL).run(200);

  assert.equal(stored(raw, 'import:1')?.missing, 0);
});

test('track update SQL writes only the provided fields', () => {
  const raw = createDb();
  upsert(raw, input('1', 'song.mp3'), 100);

  const update = buildTrackUpdate('1', { title: 'New' });
  raw.prepare(update.sql).run(...update.params);

  const track = stored(raw, '1');
  assert.ok(track);
  assert.equal(track.title, 'New');
  assert.equal(track.artist, '');
  assert.equal(track.location, 'file:///music/song.mp3');
  assert.equal(track.status, 'active');

  const empty = buildTrackUpdate('1', {});
  assert.equal(empty.sql, '');
  assert.deepEqual(empty.params, []);
});

test('count helpers separate active hidden and removed rows', () => {
  const raw = createDb();
  upsert(raw, input('scan-active', 'a.mp3'), 100);
  upsert(raw, input('scan-hidden', 'b.mp3'), 100);
  upsert(raw, input('scan-removed', 'c.mp3'), 100);
  raw.prepare("UPDATE tracks SET status = 'hidden' WHERE id = 'scan-hidden'").run();
  raw.prepare("UPDATE tracks SET status = 'removed' WHERE id = 'scan-removed'").run();
  insertOwned(raw, 'import:active', 'import', 'd.mp3');

  assert.equal(count(raw, COUNT_BY_STATUS_SQL, 'active'), 2);
  assert.equal(count(raw, COUNT_BY_STATUS_SQL, 'hidden'), 1);
  assert.equal(count(raw, COUNT_BY_STATUS_SQL, 'removed'), 1);
  assert.equal(count(raw, COUNT_ACTIVE_SCAN_SQL), 1);
  assert.equal(count(raw, COUNT_ACTIVE_OWNED_SQL), 1);
});

test('delete removes dependent rows and keeps other tracks', () => {
  const raw = createDb();
  upsert(raw, input('1', 'one.mp3'), 100);
  upsert(raw, input('2', 'two.mp3'), 100);
  raw.prepare("INSERT INTO tags (id, name, createdAt) VALUES ('t1', 'Road', 1)").run();
  raw.prepare("INSERT INTO track_tags (trackId, tagId) VALUES ('1', 't1'), ('2', 't1')").run();
  raw
    .prepare("INSERT INTO playlists (id, name, createdAt) VALUES ('pl-1', 'Mix', 1)")
    .run();
  raw
    .prepare(
      "INSERT INTO playlist_tracks (playlistId, trackId, position) VALUES ('pl-1', '1', 1), ('pl-1', '2', 2)",
    )
    .run();
  raw.prepare("INSERT INTO favorites (trackId, addedAt) VALUES ('1', 1), ('2', 2)").run();
  raw
    .prepare(
      "INSERT INTO play_history (trackId, playedAt) VALUES ('1', 1), ('2', 2)",
    )
    .run();
  raw
    .prepare(
      "INSERT INTO lyrics_cache (trackId, kind, text, fetchedAt) VALUES ('1', 'plain', 'a', 1), ('2', 'plain', 'b', 2)",
    )
    .run();

  for (const sql of TRACK_DEPENDENT_DELETE_SQL) raw.prepare(sql).run('1');
  raw.prepare(DELETE_TRACK_SQL).run('1');

  assert.equal(stored(raw, '1'), undefined);
  assert.ok(stored(raw, '2'));
  assert.deepEqual(
    raw.prepare('SELECT trackId FROM favorites').all().map((row) => (row as { trackId: string }).trackId),
    ['2'],
  );
  assert.deepEqual(
    raw.prepare('SELECT trackId FROM play_history').all().map((row) => (row as { trackId: string }).trackId),
    ['2'],
  );
  assert.deepEqual(
    raw.prepare('SELECT trackId FROM lyrics_cache').all().map((row) => (row as { trackId: string }).trackId),
    ['2'],
  );
  assert.deepEqual(
    raw
      .prepare('SELECT trackId FROM playlist_tracks')
      .all()
      .map((row) => (row as { trackId: string }).trackId),
    ['2'],
  );
  assert.deepEqual(tags(raw, '1'), []);
  assert.deepEqual(tags(raw, '2'), ['t1']);
});

test('repository chunks scan upserts at one hundred rows', async () => {
  const raw = createDb();
  const { db, transactions } = repoDb(raw);
  const repo = createTrackRepo(db);
  const tracks = Array.from({ length: 205 }, (_, index) =>
    input(`asset-${index}`, `song-${index}.mp3`),
  );

  const first = await repo.upsertScanTracks(tracks, 500);
  assert.equal(first.insertedIds.length, 205);
  assert.equal(first.updated, 0);
  assert.equal(first.missing, 0);
  assert.equal(transactions(), 3);
  assert.equal(count(raw, 'SELECT COUNT(*) AS count FROM tracks'), 205);

  const second = await repo.upsertScanTracks(tracks, 500);
  assert.equal(second.insertedIds.length, 0);
  assert.equal(second.updated, 205);
  assert.equal(second.missing, 0);
  assert.equal(transactions(), 6);
});

test('repository reports inserted and updated ids and skips removed rows', async () => {
  const raw = createDb();
  const repo = createTrackRepo(repoDb(raw).db);
  await repo.upsertScanTracks([input('keep', 'keep.mp3'), input('gone', 'gone.mp3')], 100);
  raw
    .prepare(
      "UPDATE tracks SET status = 'removed', title = 'Gone', lastSeenAt = 100 WHERE id = 'gone'",
    )
    .run();

  const result = await repo.upsertScanTracks(
    [input('keep', 'keep-new.mp3'), input('gone', 'gone-new.mp3'), input('fresh', 'fresh.mp3')],
    200,
  );

  assert.deepEqual(result.insertedIds, ['fresh']);
  assert.equal(result.updated, 1);
  assert.equal(result.missing, 0);
  const gone = stored(raw, 'gone');
  assert.equal(gone?.status, 'removed');
  assert.equal(gone?.title, 'Gone');
  assert.equal(gone?.fileName, 'gone.mp3');
  assert.equal(gone?.lastSeenAt, 100);
  assert.equal(stored(raw, 'keep')?.fileName, 'keep-new.mp3');
  assert.ok(stored(raw, 'fresh'));
});

test('repository sweeps missing only for absent active scan rows', async () => {
  const raw = createDb();
  const repo = createTrackRepo(repoDb(raw).db);
  await repo.upsertScanTracks(
    [input('present', 'present.mp3'), input('absent', 'absent.mp3')],
    100,
  );
  insertOwned(raw, 'import:1', 'import', 'owned.mp3', 100);

  const result = await repo.upsertScanTracks([input('present', 'present.mp3')], 200);

  assert.equal(result.missing, 1);
  assert.equal(stored(raw, 'present')?.missing, 0);
  assert.equal(stored(raw, 'absent')?.missing, 1);
  assert.equal(stored(raw, 'import:1')?.missing, 0);
});

test('repository deletes dependents in order and cascades tags', async () => {
  const raw = createDb();
  const { db, transactions, runs } = repoDb(raw);
  const repo = createTrackRepo(db);
  await repo.upsertScanTracks([input('1', 'one.mp3'), input('2', 'two.mp3')], 100);
  raw.prepare("INSERT INTO tags (id, name, createdAt) VALUES ('t1', 'Road', 1)").run();
  raw.prepare("INSERT INTO track_tags (trackId, tagId) VALUES ('1', 't1'), ('2', 't1')").run();
  raw.prepare("INSERT INTO playlists (id, name, createdAt) VALUES ('pl-1', 'Mix', 1)").run();
  raw
    .prepare(
      "INSERT INTO playlist_tracks (playlistId, trackId, position) VALUES ('pl-1', '1', 1), ('pl-1', '2', 2)",
    )
    .run();
  raw.prepare("INSERT INTO favorites (trackId, addedAt) VALUES ('1', 1), ('2', 2)").run();
  raw.prepare("INSERT INTO play_history (trackId, playedAt) VALUES ('1', 1), ('2', 2)").run();
  raw
    .prepare(
      "INSERT INTO lyrics_cache (trackId, kind, text, fetchedAt) VALUES ('1', 'plain', 'a', 1), ('2', 'plain', 'b', 2)",
    )
    .run();

  const before = transactions();
  await repo.deleteTrackRecord('1');

  assert.equal(transactions() - before, 1);
  assert.deepEqual(
    runs()
      .filter((sql) => sql.includes('DELETE FROM'))
      .map((sql) => sql.replace(/\s+/g, ' ').trim()),
    [
      'DELETE FROM favorites WHERE trackId = ?',
      'DELETE FROM play_history WHERE trackId = ?',
      'DELETE FROM lyrics_cache WHERE trackId = ?',
      'DELETE FROM playlist_tracks WHERE trackId = ?',
      'DELETE FROM tracks WHERE id = ?',
    ],
  );
  assert.equal(stored(raw, '1'), undefined);
  assert.ok(stored(raw, '2'));
  assert.deepEqual(
    raw.prepare('SELECT trackId FROM favorites').all().map((row) => (row as { trackId: string }).trackId),
    ['2'],
  );
  assert.deepEqual(
    raw.prepare('SELECT trackId FROM play_history').all().map((row) => (row as { trackId: string }).trackId),
    ['2'],
  );
  assert.deepEqual(
    raw.prepare('SELECT trackId FROM lyrics_cache').all().map((row) => (row as { trackId: string }).trackId),
    ['2'],
  );
  assert.deepEqual(
    raw
      .prepare('SELECT trackId FROM playlist_tracks')
      .all()
      .map((row) => (row as { trackId: string }).trackId),
    ['2'],
  );
  assert.deepEqual(tags(raw, '1'), []);
  assert.deepEqual(tags(raw, '2'), ['t1']);
});

test('findOwnedByKey matches a collision-suffixed copy by base name and size', async () => {
  const raw = createDb();
  const repo = createTrackRepo(repoDb(raw).db);
  insertOwned(raw, 'import:2', 'import', 'Song (2).mp3', 100, 4_096);

  const match = await repo.findOwnedByKey('Song.mp3', 4_096);
  assert.equal(match?.id, 'import:2');
  assert.equal(await repo.findOwnedByKey('Song.mp3', 4_097), null);
});

test('repository inserts every owned column and reads it back', async () => {
  const raw = createDb();
  const repo = createTrackRepo(repoDb(raw).db);

  const inserted = await repo.insertOwnedTrack({
    source: 'import',
    location: 'file:///owned/song.mp3',
    fileName: 'song.mp3',
    sizeBytes: 4_096,
    durationMs: 12_345,
    title: '',
    artist: 'Artist',
    album: 'Album',
    albumArtist: 'Album Artist',
    trackNumber: 3,
    discNumber: 2,
    year: 1999,
    genre: 'Rock',
    explicit: true,
    artworkUri: 'file:///art/cover.jpg',
    artworkHue: 123,
  });

  assert.match(inserted.id, /^own:/);
  assert.equal(inserted.title, titleFromFilename('song.mp3'));
  assert.equal(inserted.status, 'active');
  assert.equal(inserted.missing, 0);
  assert.equal(inserted.artworkHue, 123);

  assert.deepEqual(stored(raw, inserted.id), {
    id: inserted.id,
    source: 'import',
    location: 'file:///owned/song.mp3',
    fileName: 'song.mp3',
    sizeBytes: 4_096,
    durationMs: 12_345,
    title: 'song',
    artist: 'Artist',
    album: 'Album',
    albumArtist: 'Album Artist',
    trackNumber: 3,
    discNumber: 2,
    year: 1999,
    genre: 'Rock',
    explicit: 1,
    artworkUri: 'file:///art/cover.jpg',
    status: 'active',
    missing: 0,
    addedAt: inserted.addedAt,
    lastSeenAt: inserted.lastSeenAt,
    artworkHue: 123,
  });

  const defaulted = await repo.insertOwnedTrack({
    source: 'download',
    location: 'file:///owned/02 - Other.mp3',
    fileName: '02 - Other.mp3',
    durationMs: 0,
    title: '',
    artist: '',
    album: '',
  });
  assert.equal(defaulted.title, titleFromFilename('02 - Other.mp3'));
  assert.equal(defaulted.artworkHue, hueFromSeed('02 - Other.mp3'));
  assert.equal(defaulted.explicit, undefined);
  assert.equal(stored(raw, defaulted.id)?.sizeBytes, null);
});
