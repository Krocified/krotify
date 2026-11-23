import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAtEnd,
  nextIndex,
  previousAction,
  previousIndex,
  RESTART_THRESHOLD_MS,
  upcomingQueue,
} from '../src/lib/queue.ts';
import type { Track } from '../src/types.ts';

const track = (id: string): Track => ({
  id,
  uri: `file:///${id}.mp3`,
  source: 'scan',
  missing: 0,
  title: id,
  artist: '',
  album: '',
  durationMs: 1_000,
  artworkHue: 0,
});

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

test('isAtEnd treats the last moments as the end', () => {
  assert.equal(isAtEnd(199_800, 200_000), true);
  assert.equal(isAtEnd(200_000, 200_000), true);
  assert.equal(isAtEnd(199_000, 200_000), false);
  assert.equal(isAtEnd(0, 0), false);
});

test('upcomingQueue returns the tracks after the current index', () => {
  const queue = ['a', 'b', 'c', 'd'].map(track);
  assert.deepEqual(upcomingQueue(queue, 1).map((item) => item.id), ['c', 'd']);
  assert.deepEqual(upcomingQueue(queue, 0).map((item) => item.id), ['b', 'c', 'd']);
});

test('upcomingQueue is empty at the end and outside the queue', () => {
  const queue = ['a', 'b'].map(track);
  assert.deepEqual(upcomingQueue(queue, 1), []);
  assert.deepEqual(upcomingQueue(queue, -1), []);
  assert.deepEqual(upcomingQueue(queue, 5), []);
  assert.deepEqual(upcomingQueue([], 0), []);
});
