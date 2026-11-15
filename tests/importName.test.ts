import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extensionForMime, importedFileName } from '../src/lib/importName.ts';

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

test('adds the MIME extension when the provider name has none', () => {
  assert.equal(importedFileName('audio:1234', 'track-1.mp3', 'audio/mpeg'), 'audio-1234.mp3');
});

test('maps common audio MIME types', () => {
  assert.equal(extensionForMime('audio/mpeg'), 'mp3');
  assert.equal(extensionForMime('audio/mp4'), 'm4a');
  assert.equal(extensionForMime('audio/x-flac'), 'flac');
  assert.equal(extensionForMime('audio/ogg'), 'ogg');
  assert.equal(extensionForMime('application/octet-stream'), null);
});

test('maps common image MIME types', () => {
  assert.equal(extensionForMime('image/png'), 'png');
  assert.equal(extensionForMime('image/jpeg'), 'jpg');
  assert.equal(extensionForMime('image/webp'), 'webp');
  assert.equal(extensionForMime('image/heic'), 'heic');
  assert.equal(extensionForMime('image/heif'), 'heic');
});

test('keeps a real name and does not double the extension', () => {
  assert.equal(importedFileName('Song.mp3', 'track.mp3', 'audio/mpeg'), 'Song.mp3');
});
