import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importedFileName } from '../src/lib/importName.ts';

test('importedFileName keeps a normal name', () => {
  assert.equal(importedFileName('Song.mp3', 'track'), 'Song.mp3');
});

test('importedFileName decodes percent-escaped picker names', () => {
  assert.equal(importedFileName('My%20Song%20%28Live%29.mp3', 'track'), 'My Song (Live).mp3');
});

test('importedFileName takes the basename of provider paths', () => {
  assert.equal(importedFileName('document:primary:Music/Song.mp3', 'track'), 'Song.mp3');
  assert.equal(importedFileName('content://media/external/audio/media/Song.mp3', 'track'), 'Song.mp3');
});

test('importedFileName strips illegal filename characters', () => {
  assert.equal(importedFileName('bad:name?.mp3', 'track'), 'bad-name-.mp3');
});

test('importedFileName falls back when nothing usable remains', () => {
  assert.equal(importedFileName('', 'track'), 'track');
  assert.equal(importedFileName('   ', 'track'), 'track');
});
