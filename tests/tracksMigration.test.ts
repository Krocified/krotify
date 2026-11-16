import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DB_VERSION, V4_TABLE_SQL } from '../src/db/schema.ts';
import { parseLegacyExcluded, parseLegacyImports } from '../src/db/legacy.ts';
import { migrateV3ToV4, type MigrationInput } from '../src/db/migrateV4.ts';
import {
  createV3Fixture,
  insertMetadata,
  seedV3,
  type Fixture,
} from './fixtures/v3.ts';

function migrate(
  fixture: Fixture,
  overrides: Partial<MigrationInput> = {},
): Promise<{ importRows: number; scanSeeds: number; hidden: number }> {
  return migrateV3ToV4(fixture.db, {
    fromVersion: 3,
    now: 1_000,
    imports: [],
    excluded: [],
    fileExists: () => true,
    ...overrides,
  });
}

function rows<T>(fixture: Fixture, sql: string, ...params: (string | number | null)[]): T[] {
  return fixture.raw
    .prepare(sql)
    .all(...params)
    .map((row) => ({ ...row })) as T[];
}

type TrackRow = {
  id: string;
  source: string;
  location: string;
  fileName: string;
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
  artworkHue: number;
};

function trackRow(fixture: Fixture, id: string): TrackRow {
  const found = rows<TrackRow>(fixture, 'SELECT * FROM tracks WHERE id = ?', id);
  assert.equal(found.length, 1, `expected one tracks row for ${id}`);
  return found[0];
}

test('schema version is four', () => {
  assert.equal(DB_VERSION, 4);
});

test('v4 schema creates tracks tags track_tags and settings', () => {
  const fixture = createV3Fixture();
  fixture.raw.exec(V4_TABLE_SQL);
  const names = rows<{ name: string }>(
    fixture,
    "SELECT name FROM sqlite_master WHERE type IN ('table', 'index')",
  ).map((row) => row.name);
  for (const expected of [
    'tracks',
    'tags',
    'track_tags',
    'settings',
    'tracks_location_idx',
    'tracks_status_idx',
  ]) {
    assert.ok(names.includes(expected), `missing ${expected}`);
  }
});

test('legacy import parser keeps only import tracks with a location', () => {
  const raw = JSON.stringify([
    {
      id: 'import:abc',
      uri: 'file:///docs/imports/song.mp3',
      source: 'import',
      title: 'Song',
      artist: 'Me',
      durationMs: 123,
      artworkHue: 42,
    },
    { id: 'x' },
    'nope',
    { id: 'import:scan', uri: 'file:///scan.mp3', source: 'scan' },
    { id: 'import:empty', uri: '', source: 'import' },
  ]);
  assert.deepEqual(parseLegacyImports(raw), [
    {
      id: 'import:abc',
      uri: 'file:///docs/imports/song.mp3',
      title: 'Song',
      artist: 'Me',
      durationMs: 123,
      artworkHue: 42,
    },
  ]);
  assert.deepEqual(parseLegacyImports(JSON.stringify([{ id: 'import:min', uri: 'file:///a.mp3', source: 'import' }])), [
    { id: 'import:min', uri: 'file:///a.mp3', title: '', artist: '', durationMs: 0 },
  ]);
  assert.deepEqual(parseLegacyImports('not json'), []);
  assert.deepEqual(parseLegacyImports(null), []);
});

test('legacy exclusion parser reads ids from stored tracks', () => {
  const raw = JSON.stringify([
    { id: '12345', uri: 'file:///a.mp3', source: 'scan', title: 'A' },
    { id: 'import:abc', uri: 'file:///b.mp3', source: 'import' },
    { id: 7 },
    'nope',
  ]);
  assert.deepEqual(parseLegacyExcluded(raw), [{ id: '12345' }, { id: 'import:abc' }]);
  assert.deepEqual(parseLegacyExcluded('not json'), []);
  assert.deepEqual(parseLegacyExcluded(null), []);
});

test('v3 favorites playlists history and lyrics ids survive the v4 migration', async () => {
  const fixture = createV3Fixture();
  seedV3(fixture);
  await migrate(fixture, {
    imports: [
      { id: 'import:abc', uri: 'file:///docs/imports/song.mp3', title: 'Song', artist: '', durationMs: 9 },
    ],
  });

  assert.deepEqual(
    rows(fixture, 'SELECT trackId, addedAt FROM favorites'),
    [{ trackId: '12345', addedAt: 200 }],
  );
  assert.deepEqual(
    rows(fixture, 'SELECT playlistId, trackId, position FROM playlist_tracks'),
    [{ playlistId: 'pl-1', trackId: '12345', position: 1000 }],
  );
  assert.deepEqual(
    rows(fixture, 'SELECT trackId, playedAt FROM play_history'),
    [{ trackId: 'import:legacy', playedAt: 300 }],
  );
  assert.deepEqual(
    rows(fixture, 'SELECT trackId, kind, text, fetchedAt FROM lyrics_cache'),
    [{ trackId: '12345', kind: 'plain', text: 'la la', fetchedAt: 400 }],
  );
});

test('v4 migration inserts imports before folding cached metadata', async () => {
  const fixture = createV3Fixture();
  insertMetadata(fixture, 'import:abc');
  await migrate(fixture, {
    imports: [
      { id: 'import:abc', uri: 'file:///docs/imports/song.mp3', title: 'Song', artist: '', durationMs: 9 },
    ],
  });

  const found = rows<{ count: number; source: string }>(
    fixture,
    'SELECT COUNT(*) AS count, MAX(source) AS source FROM tracks WHERE id = ?',
    'import:abc',
  );
  assert.equal(found[0].count, 1);
  assert.equal(found[0].source, 'import');
});

test('v4 migration folds cached metadata into the matching import row', async () => {
  const fixture = createV3Fixture();
  insertMetadata(fixture, 'import:abc', {
    title: 'Cached Title',
    artist: 'Cached Artist',
    album: 'Cached Album',
    albumArtist: 'Cached Album Artist',
    year: 2001,
    trackNumber: 4,
    discNumber: 2,
    genre: 'Jazz',
    artworkUri: 'file:///art/cached.jpg',
    explicit: 1,
  });
  await migrate(fixture, {
    imports: [
      { id: 'import:abc', uri: 'file:///docs/imports/song.mp3', title: 'Song', artist: 'Me', durationMs: 9 },
    ],
  });

  const row = trackRow(fixture, 'import:abc');
  assert.equal(row.source, 'import');
  assert.equal(row.album, 'Cached Album');
  assert.equal(row.albumArtist, 'Cached Album Artist');
  assert.equal(row.year, 2001);
  assert.equal(row.trackNumber, 4);
  assert.equal(row.discNumber, 2);
  assert.equal(row.genre, 'Jazz');
  assert.equal(row.artworkUri, 'file:///art/cached.jpg');
  assert.equal(row.explicit, 1);
  assert.equal(row.title, 'Song');
  assert.equal(row.artist, 'Me');
});

test('v4 migration folds an artwork-only cache row with a null album', async () => {
  const fixture = createV3Fixture();
  insertMetadata(fixture, 'import:art', {
    title: null,
    artist: null,
    album: null,
    albumArtist: null,
    year: null,
    trackNumber: null,
    discNumber: null,
    genre: null,
    explicit: null,
    artworkUri: 'file:///art/cached.jpg',
  });
  await migrate(fixture, {
    imports: [
      { id: 'import:art', uri: 'file:///docs/imports/art.mp3', title: 'Song', artist: 'Me', durationMs: 9 },
    ],
  });

  const row = trackRow(fixture, 'import:art');
  assert.equal(row.source, 'import');
  assert.equal(row.album, '');
  assert.equal(row.albumArtist, null);
  assert.equal(row.year, null);
  assert.equal(row.trackNumber, null);
  assert.equal(row.discNumber, null);
  assert.equal(row.genre, null);
  assert.equal(row.explicit, null);
  assert.equal(row.artworkUri, 'file:///art/cached.jpg');
  assert.equal(row.title, 'Song');
  assert.equal(row.artist, 'Me');
});

test('v4 migration leaves unmatched metadata as an unresolved scan seed', async () => {
  const fixture = createV3Fixture();
  seedV3(fixture);
  await migrate(fixture);

  const row = trackRow(fixture, '12345');
  assert.equal(row.source, 'scan');
  assert.equal(row.location, '');
  assert.equal(row.status, 'active');
  assert.equal(row.missing, 1);
  assert.equal(row.title, 'Cached Title');
  assert.equal(row.artist, 'Cached Artist');
  assert.equal(row.album, 'Cached Album');
  assert.equal(row.albumArtist, 'Cached Album Artist');
  assert.equal(row.year, 2001);
  assert.equal(row.trackNumber, 4);
  assert.equal(row.discNumber, 1);
  assert.equal(row.genre, 'Jazz');
  assert.equal(row.artworkUri, 'file:///art/cached.jpg');
  assert.equal(row.explicit, 0);
});

test('v4 migration hides excluded ids and keeps the file state', async () => {
  const fixture = createV3Fixture();
  await migrate(fixture, {
    imports: [
      { id: 'import:abc', uri: 'file:///docs/imports/song.mp3', title: 'Song', artist: '', durationMs: 9 },
    ],
    excluded: [{ id: 'import:abc' }, { id: 'import:gone' }],
    fileExists: () => true,
  });

  const hidden = trackRow(fixture, 'import:abc');
  assert.equal(hidden.status, 'hidden');
  assert.equal(hidden.missing, 0);

  const orphan = trackRow(fixture, 'import:gone');
  assert.equal(orphan.status, 'hidden');
  assert.equal(orphan.location, '');
  assert.equal(orphan.missing, 1);
});

test('v4 migration keeps scan asset ids and import ids verbatim', async () => {
  const fixture = createV3Fixture();
  seedV3(fixture);
  await migrate(fixture, {
    imports: [
      { id: 'import:h', uri: 'file:///docs/imports/song.mp3', title: '', artist: '', durationMs: 9 },
    ],
  });

  assert.equal(trackRow(fixture, '12345').id, '12345');
  assert.equal(trackRow(fixture, 'import:h').id, 'import:h');
  assert.equal(trackRow(fixture, 'import:h').source, 'import');
});

test('v4 migration marks a migrated install with legacy storage', async () => {
  const fixture = createV3Fixture();
  await migrate(fixture, { fromVersion: 3 });
  assert.deepEqual(
    rows(fixture, 'SELECT value FROM settings WHERE key = ?', 'storageRootKind'),
    [{ value: 'legacy' }],
  );
});

test('v4 migration leaves a fresh install on the Krotify folder', async () => {
  const fixture = createV3Fixture();
  await migrate(fixture, { fromVersion: 0 });
  assert.deepEqual(
    rows(fixture, 'SELECT value FROM settings WHERE key = ?', 'storageRootKind'),
    [{ value: 'krotify' }],
  );
});
