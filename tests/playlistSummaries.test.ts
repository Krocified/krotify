import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

const repoSource = readFileSync(new URL('../src/db/repo.ts', import.meta.url), 'utf8');
const sqlMatch = /export const PLAYLIST_SUMMARIES_SQL = `([\s\S]*?)`;/.exec(repoSource);
assert.ok(sqlMatch, 'PLAYLIST_SUMMARIES_SQL is exported from the repo');
const PLAYLIST_SUMMARIES_SQL = sqlMatch[1];

type SummaryRow = {
  id: string;
  trackCount: number;
  firstArtworkUri: string | null;
};

function createDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      description TEXT,
      artworkUri TEXT
    );
    CREATE TABLE playlist_tracks (
      playlistId TEXT NOT NULL,
      trackId TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (playlistId, trackId)
    );
    CREATE TABLE tracks (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active',
      artworkUri TEXT
    );
    INSERT INTO playlists (id, name, createdAt) VALUES
      ('p1', 'Alpha', 2),
      ('p2', 'Beta', 1);
    INSERT INTO tracks (id, status, artworkUri) VALUES
      ('t1', 'active', 'file:///a.jpg'),
      ('t2', 'hidden', 'file:///b.jpg');
    INSERT INTO playlist_tracks (playlistId, trackId, position) VALUES
      ('p1', 't1', 1000),
      ('p1', 't2', 2000),
      ('p2', 'missing', 1000);
  `);
  return db;
}

test('lists track counts and the first active artwork', () => {
  const db = createDb();
  const rows = db.prepare(PLAYLIST_SUMMARIES_SQL).all() as SummaryRow[];
  db.close();

  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.id === 'p1')?.trackCount, 1);
  assert.equal(rows.find((row) => row.id === 'p1')?.firstArtworkUri, 'file:///a.jpg');
  assert.equal(rows.find((row) => row.id === 'p2')?.trackCount, 0);
  assert.equal(rows.find((row) => row.id === 'p2')?.firstArtworkUri, null);
});
