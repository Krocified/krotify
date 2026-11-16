import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownedTrackId, isOwnedId } from '../src/tracks/ids.ts';

test('owned ids use the own prefix', () => {
  assert.equal(
    ownedTrackId(() => '00000000-0000-4000-8000-000000000000'),
    'own:00000000-0000-4000-8000-000000000000',
  );
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
