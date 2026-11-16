import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayableWindow, nextPlayableIndex, shouldProbeDuration } from '../src/lib/playbackRecovery.ts';

test('buildPlayableWindow drops dead entries and reindexes the target', () => {
  const result = buildPlayableWindow(
    [
      { global: 4, uri: 'file:///a.mp3' },
      { global: 5, uri: null },
      { global: 6, uri: 'file:///c.mp3' },
    ],
    6,
  );
  assert.deepEqual(result.playable, [
    { global: 4, uri: 'file:///a.mp3' },
    { global: 6, uri: 'file:///c.mp3' },
  ]);
  assert.equal(result.localIndex, 1);
  assert.deepEqual(result.missingGlobals, [5]);
});

test('buildPlayableWindow reports a dead target with no local index', () => {
  const result = buildPlayableWindow(
    [
      { global: 0, uri: 'file:///a.mp3' },
      { global: 1, uri: null },
    ],
    1,
  );
  assert.equal(result.localIndex, -1);
  assert.deepEqual(result.missingGlobals, [1]);
});

test('nextPlayableIndex skips dead entries forward', () => {
  assert.equal(nextPlayableIndex(6, 1, new Set([0, 4, 5])), 4);
});

test('nextPlayableIndex wraps only when asked', () => {
  assert.equal(nextPlayableIndex(6, 4, new Set([0])), -1);
  assert.equal(nextPlayableIndex(6, 4, new Set([0]), true), 0);
});

test('nextPlayableIndex returns minus one when nothing is playable', () => {
  assert.equal(nextPlayableIndex(3, 0, new Set(), true), -1);
});

test('shouldProbeDuration probes zero-duration non-demo tracks', () => {
  assert.equal(shouldProbeDuration(0, 'import'), true);
  assert.equal(shouldProbeDuration(-1, 'scan'), true);
});

test('shouldProbeDuration skips playable and demo tracks', () => {
  assert.equal(shouldProbeDuration(289_000, 'import'), false);
  assert.equal(shouldProbeDuration(0, 'demo'), false);
});
