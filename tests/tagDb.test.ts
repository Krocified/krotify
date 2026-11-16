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
