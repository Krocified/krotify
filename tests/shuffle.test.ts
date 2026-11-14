import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreOrder, shuffleOrder } from '../src/lib/shuffle.ts';
import type { Track } from '../src/types.ts';

const track = (id: string): Track => ({
  id,
  uri: `file:///${id}.mp3`,
  source: 'scan',
  title: id,
  artist: '',
  album: '',
  durationMs: 1_000,
  artworkHue: 0,
});

const queue = ['a', 'b', 'c', 'd', 'e'].map(track);
const ids = (tracks: Track[]): string[] => tracks.map((item) => item.id);

test('shuffleOrder keeps the current track first and every other track once', () => {
  const result = shuffleOrder(queue, 2, () => 0);
  assert.equal(result.index, 0);
  assert.equal(result.order[0].id, 'c');
  assert.equal(result.order.length, queue.length);
  assert.equal(new Set(ids(result.order)).size, queue.length);
  assert.deepEqual(new Set(ids(result.order)), new Set(ids(queue)));
});

test('shuffleOrder is deterministic with a seeded RNG', () => {
  const seeded = (seed: number): (() => number) => {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  };
  const first = shuffleOrder(queue, 2, seeded(42));
  const second = shuffleOrder(queue, 2, seeded(42));
  assert.deepEqual(ids(first.order), ids(second.order));
  assert.equal(first.order[0].id, 'c');
  assert.deepEqual(new Set(ids(first.order)), new Set(ids(queue)));
});

test('shuffleOrder follows the RNG draw order', () => {
  const draws = [0, 0, 0];
  let next = 0;
  const result = shuffleOrder(queue, 2, () => draws[next++] ?? 0);
  assert.deepEqual(ids(result.order), ['c', 'b', 'd', 'e', 'a']);
});

test('shuffleOrder leaves the current track out of the shuffled remainder', () => {
  const result = shuffleOrder(queue, 0, () => 0);
  assert.equal(result.order[0].id, 'a');
  assert.deepEqual(ids(result.order), ['a', 'c', 'd', 'e', 'b']);
});

test('shuffleOrder shuffles the whole queue without a valid current index', () => {
  const result = shuffleOrder(queue, -1, () => 0);
  assert.equal(result.index, 0);
  assert.deepEqual(ids(result.order), ['b', 'c', 'd', 'e', 'a']);
});

test('shuffleOrder handles an empty queue', () => {
  assert.deepEqual(shuffleOrder([], 0, () => 0), { order: [], index: -1 });
});

test('restoreOrder returns the original order at the current track', () => {
  const original = ['a', 'b', 'c', 'd', 'e'].map(track);
  const result = restoreOrder(original, 'd');
  assert.deepEqual(ids(result.order), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(result.index, 3);
});

test('restoreOrder reports a missing current track', () => {
  const original = ['a', 'b'].map(track);
  assert.deepEqual(restoreOrder(original, 'z'), { order: original, index: -1 });
  assert.deepEqual(restoreOrder([], 'a'), { order: [], index: -1 });
});
