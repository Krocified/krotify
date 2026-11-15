import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveId } from '../src/lib/playlistOrder.ts';

test('moveId moves an item forward', () => {
  assert.deepEqual(moveId(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
});

test('moveId moves an item backward', () => {
  assert.deepEqual(moveId(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
});

test('moveId keeps a single-item order', () => {
  assert.deepEqual(moveId(['a'], 0, 0), ['a']);
});

test('moveId keeps the order for equal or out-of-range indices', () => {
  const ids = ['a', 'b', 'c'];
  assert.deepEqual(moveId(ids, 1, 1), ids);
  assert.deepEqual(moveId(ids, -1, 2), ids);
  assert.deepEqual(moveId(ids, 0, 3), ids);
  assert.deepEqual(moveId(ids, 5, 0), ids);
});

test('moveId does not mutate its input', () => {
  const ids = ['a', 'b', 'c'];
  moveId(ids, 0, 2);
  assert.deepEqual(ids, ['a', 'b', 'c']);
});
