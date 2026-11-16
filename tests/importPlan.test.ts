import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  copyIsUsable,
  decideImport,
  type ImportCandidate,
} from '../src/imports/plan.ts';

const candidate = (overrides: Partial<ImportCandidate> = {}): ImportCandidate => ({
  id: 'own:1',
  status: 'active',
  fileName: 'song.mp3',
  sizeBytes: 4096,
  location: 'file:///music/song.mp3',
  ...overrides,
});

test('copy validation only rejects zero bytes', () => {
  assert.equal(copyIsUsable(0), false);
  assert.equal(copyIsUsable(null), false);
  assert.equal(copyIsUsable(undefined), false);
  assert.equal(copyIsUsable(1), true);
  assert.equal(copyIsUsable(4096), true);
});

test('a new name and size is an insert', () => {
  const decision = decideImport([], { fileName: 'song.mp3', sizeBytes: 4096 }, () => true);
  assert.deepEqual(decision, { kind: 'insert' });
});

test('an active row with the same name and size is a duplicate', () => {
  const decision = decideImport(
    [candidate()],
    { fileName: 'song.mp3', sizeBytes: 4096 },
    () => true,
  );
  assert.deepEqual(decision, { kind: 'duplicate', id: 'own:1' });
});

test('a removed row is reactivated and keeps its file when it exists', () => {
  const decision = decideImport(
    [candidate({ status: 'removed' })],
    { fileName: 'song.mp3', sizeBytes: 4096 },
    () => true,
  );
  assert.deepEqual(decision, { kind: 'reactivate', id: 'own:1', reuseFile: true });
});

test('a removed row is reactivated into the new copy when its file is gone', () => {
  const decision = decideImport(
    [candidate({ status: 'removed' })],
    { fileName: 'song.mp3', sizeBytes: 4096 },
    () => false,
  );
  assert.deepEqual(decision, { kind: 'reactivate', id: 'own:1', reuseFile: false });
});

test('a hidden row stays hidden and is reported as skipped', () => {
  const decision = decideImport(
    [candidate({ status: 'hidden' })],
    { fileName: 'song.mp3', sizeBytes: 4096 },
    () => true,
  );
  assert.deepEqual(decision, { kind: 'hidden', id: 'own:1' });
});
