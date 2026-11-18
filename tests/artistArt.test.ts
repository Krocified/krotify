import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { DB_VERSION } from '../src/db/schema.ts';

const source = readFileSync(new URL('../src/library/artistArtwork.ts', import.meta.url), 'utf8');
const table = /export const ARTIST_ART_TABLE_SQL = `([\s\S]*?)`;/.exec(source)?.[1];
const upsert = /export const ARTIST_ART_UPSERT_SQL = `([\s\S]*?)`;/.exec(source)?.[1];

test('artist_art upserts one row per key', () => {
  assert.ok(table && upsert);
  const db = new DatabaseSync(':memory:');
  db.exec(table);
  db.prepare(upsert).run('the band', 'file:///a.jpg', 1);
  db.prepare(upsert).run('the band', 'file:///b.jpg', 2);
  const rows = db.prepare('SELECT artistKey, artworkUri FROM artist_art').all();
  assert.deepEqual(
    rows.map((row) => ({ ...row })),
    [{ artistKey: 'the band', artworkUri: 'file:///b.jpg' }],
  );
  db.close();
});

test('database version is 5', () => {
  assert.equal(DB_VERSION, 5);
});
