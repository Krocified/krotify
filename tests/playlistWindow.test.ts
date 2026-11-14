import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextAppendRange, nextWindowSize, playlistWindow, wrapTarget } from '../src/lib/playlistWindow.ts';

test('playlistWindow keeps the first track at the start', () => {
  assert.deepEqual(playlistWindow(0, 20, 4), { start: 0, end: 4, localIndex: 0 });
});

test('playlistWindow centers a middle track', () => {
  assert.deepEqual(playlistWindow(10, 20, 4), { start: 6, end: 14, localIndex: 4 });
});

test('playlistWindow keeps the last track at the end', () => {
  assert.deepEqual(playlistWindow(19, 20, 4), { start: 15, end: 19, localIndex: 4 });
});

test('playlistWindow handles a queue shorter than the window', () => {
  assert.deepEqual(playlistWindow(1, 3, 4), { start: 0, end: 2, localIndex: 1 });
  assert.deepEqual(playlistWindow(0, 1, 4), { start: 0, end: 0, localIndex: 0 });
});

test('playlistWindow returns an empty range for an empty queue', () => {
  assert.deepEqual(playlistWindow(0, 0, 4), { start: 0, end: -1, localIndex: -1 });
});

test('playlistWindow uses the default radius', () => {
  assert.deepEqual(playlistWindow(10, 100), { start: 5, end: 15, localIndex: 5 });
});

test('playlistWindow clamps an out-of-range index', () => {
  assert.deepEqual(playlistWindow(-3, 10, 2), { start: 0, end: 2, localIndex: 0 });
  assert.deepEqual(playlistWindow(99, 10, 2), { start: 7, end: 9, localIndex: 2 });
});

test('nextWindowSize appends while fewer than three tracks remain ahead', () => {
  assert.equal(nextWindowSize(1, 3, 10, 0), 2);
  assert.equal(nextWindowSize(2, 3, 10, 0), 3);
  assert.equal(nextWindowSize(0, 1, 10, 0), 3);
});

test('nextWindowSize appends nothing at the end of the queue', () => {
  assert.equal(nextWindowSize(2, 3, 10, 7), 0);
  assert.equal(nextWindowSize(0, 6, 6, 0), 0);
});

test('nextWindowSize appends nothing while three or more tracks remain ahead', () => {
  assert.equal(nextWindowSize(1, 7, 20, 0), 0);
  assert.equal(nextWindowSize(0, 4, 20, 0), 0);
});

test('nextWindowSize caps the append at the queue end', () => {
  assert.equal(nextWindowSize(4, 0, 10, 6), 0);
  assert.equal(nextWindowSize(2, 6, 8, 0), 0);
  assert.equal(nextWindowSize(5, 8, 10, 0), 1);
});

test('nextAppendRange derives the next global from the last loaded entry', () => {
  assert.deepEqual(nextAppendRange([3, 4, 7, 8], 4, 12, 3), { from: 9, to: 11, count: 3 });
  assert.deepEqual(nextAppendRange([5, 6, 7], 3, 9, 2), { from: 8, to: 8, count: 1 });
});

test('nextAppendRange appends nothing when the loaded window contains the queue end', () => {
  assert.deepEqual(nextAppendRange([7, 8, 9], 3, 10, 2), { from: 10, to: 9, count: 0 });
  assert.deepEqual(nextAppendRange([], 0, 10, 0), { from: 0, to: -1, count: 0 });
});

test('wrapTarget advances mid-queue instead of replaying the window start', () => {
  assert.equal(wrapTarget(50, 100, 'forward'), 51);
  assert.equal(wrapTarget(99, 100, 'forward'), 0);
});

test('wrapTarget steps back mid-queue and wraps only at the queue start', () => {
  assert.equal(wrapTarget(50, 100, 'backward'), 49);
  assert.equal(wrapTarget(0, 100, 'backward'), 99);
  assert.equal(wrapTarget(0, 0, 'backward'), -1);
});
