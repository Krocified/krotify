import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextWindowSize, playlistWindow } from '../src/lib/playlistWindow.ts';

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
