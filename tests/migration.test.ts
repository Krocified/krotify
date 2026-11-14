import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIGRATION_V2_COLUMNS, pendingColumnMigrations } from '../src/db/schema.ts';

const v1Columns = [
  'id',
  'title',
  'artist',
  'album',
  'albumArtist',
  'year',
  'trackNumber',
  'genre',
  'artworkUri',
];

const v2Columns = [...v1Columns, 'discNumber', 'explicit'];

test('v1 metadata columns produce both v2 migrations', () => {
  const migrations = pendingColumnMigrations(v1Columns);
  assert.equal(migrations.length, 2);
  assert.deepEqual(migrations, MIGRATION_V2_COLUMNS.map((column) => column.sql));
  assert.match(migrations[0], /discNumber/);
  assert.match(migrations[1], /explicit/);
});

test('v2 metadata columns need no migrations', () => {
  assert.deepEqual(pendingColumnMigrations(v2Columns), []);
});

test('partially migrated metadata only adds the missing column', () => {
  const migrations = pendingColumnMigrations([...v1Columns, 'discNumber']);
  assert.equal(migrations.length, 1);
  assert.match(migrations[0], /explicit/);
});
