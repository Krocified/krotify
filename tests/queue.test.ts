import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextIndex, previousIndex } from '../src/lib/queue.ts';

test('nextIndex walks the middle and stops at the end', () => {
  assert.equal(nextIndex(0, 3), 1);
  assert.equal(nextIndex(1, 3), 2);
  assert.equal(nextIndex(2, 3), -1);
});

test('previousIndex walks the middle and stops at the start', () => {
  assert.equal(previousIndex(2, 3), 1);
  assert.equal(previousIndex(1, 3), 0);
  assert.equal(previousIndex(0, 3), -1);
});

test('nextIndex/previousIndex handle empty and single-item arrays', () => {
  assert.equal(nextIndex(0, 0), -1);
  assert.equal(previousIndex(0, 0), -1);
  assert.equal(nextIndex(0, 1), -1);
  assert.equal(previousIndex(0, 1), -1);
});

test('out-of-range positions have no neighbour', () => {
  assert.equal(nextIndex(-1, 3), -1);
  assert.equal(previousIndex(-1, 3), -1);
  assert.equal(nextIndex(3, 3), -1);
  assert.equal(previousIndex(3, 3), -1);
});
