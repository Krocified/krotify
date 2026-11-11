import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextIndex, previousAction, previousIndex, RESTART_THRESHOLD_MS } from '../src/lib/queue.ts';

test('nextIndex walks forward and stops at the end', () => {
  assert.equal(nextIndex(0, 3), 1);
  assert.equal(nextIndex(1, 3), 2);
  assert.equal(nextIndex(2, 3), -1);
  assert.equal(nextIndex(-1, 3), -1);
  assert.equal(nextIndex(0, 1), -1);
  assert.equal(nextIndex(0, 0), -1);
});

test('previousIndex walks backward and stops at the start', () => {
  assert.equal(previousIndex(2, 3), 1);
  assert.equal(previousIndex(1, 3), 0);
  assert.equal(previousIndex(0, 3), -1);
  assert.equal(previousIndex(2, 0), -1);
});

test('previousAction restarts after the threshold', () => {
  assert.deepEqual(previousAction(RESTART_THRESHOLD_MS + 1, 1, 3), { type: 'restart' });
  assert.deepEqual(previousAction(60_000, 0, 3), { type: 'restart' });
});

test('previousAction skips back when the track just started', () => {
  assert.deepEqual(previousAction(0, 2, 3), { type: 'previous', index: 1 });
  assert.deepEqual(previousAction(RESTART_THRESHOLD_MS, 1, 3), { type: 'previous', index: 0 });
});

test('previousAction does nothing at the first track within the threshold', () => {
  assert.deepEqual(previousAction(0, 0, 3), { type: 'none' });
  assert.deepEqual(previousAction(RESTART_THRESHOLD_MS, 0, 1), { type: 'none' });
});
