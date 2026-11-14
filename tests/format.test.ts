import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, titleFromFilename } from '../src/lib/format.ts';

test('formatDuration renders mm:ss and h:mm:ss', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(59_000), '0:59');
  assert.equal(formatDuration(204_000), '3:24');
  assert.equal(formatDuration(3_723_000), '1:02:03');
  assert.equal(formatDuration(-5), '0:00');
  assert.equal(formatDuration(Number.NaN), '0:00');
});

test('titleFromFilename strips extension and track numbers', () => {
  assert.equal(titleFromFilename('Song.mp3'), 'Song');
  assert.equal(titleFromFilename('01 - Artist - Song.mp3'), 'Artist - Song');
  assert.equal(titleFromFilename('01_Song.flac'), 'Song');
  assert.equal(titleFromFilename('07. Song.ogg'), 'Song');
  assert.equal(titleFromFilename('track01.mp3'), 'track01');
  assert.equal(titleFromFilename('  spaced  name .mp3'), 'spaced name');
  assert.equal(titleFromFilename('My%20Song%20%28Live%29.mp3'), 'My Song (Live)');
});
