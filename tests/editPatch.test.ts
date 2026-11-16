import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ARTWORK_BYTES,
  validateArtworkInput,
} from '../src/lib/artworkInput.ts';
import { buildTrackFieldPatch, type EditForm } from '../src/tracks/editPatch.ts';
import type { TrackRecord } from '../src/tracks/types.ts';

const track: TrackRecord = {
  id: 'own:1',
  source: 'import',
  location: 'file:///music/song.mp3',
  fileName: 'song.mp3',
  sizeBytes: 4096,
  durationMs: 1_000,
  title: 'Old Title',
  artist: 'Artist',
  album: 'Album',
  status: 'active',
  missing: 0,
  addedAt: 1,
  lastSeenAt: 1,
  artworkHue: 0,
};

const form = (overrides: Partial<EditForm> = {}): EditForm => ({
  title: 'Old Title',
  artist: 'Artist',
  album: 'Album',
  albumArtist: '',
  genre: '',
  trackNumber: '',
  discNumber: '',
  year: '',
  ...overrides,
});

test('rename patches only the title', () => {
  const result = buildTrackFieldPatch(
    track,
    form({ title: 'New Title', artist: 'Another Artist', album: 'Another Album' }),
    true,
  );
  assert.deepEqual(result, { patch: { title: 'New Title' } });
});

test('an empty title is rejected', () => {
  const result = buildTrackFieldPatch(track, form({ title: '   ' }), false);
  assert.equal(result.error, 'Title is required.');
});

test('unchanged fields are omitted', () => {
  const result = buildTrackFieldPatch(track, form({ title: ' Old Title ' }), false);
  assert.deepEqual(result, { patch: {} });
});

test('artwork validation accepts an image under the limit', () => {
  assert.deepEqual(
    validateArtworkInput({ mimeType: 'image/jpeg', sizeBytes: 1024 }),
    { ok: true },
  );
});

test('artwork validation rejects a non image MIME', () => {
  const result = validateArtworkInput({ mimeType: 'audio/mpeg', sizeBytes: 1024 });
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.errors.join(' '), /image/i);
});

test('artwork validation rejects a file over ten megabytes', () => {
  const result = validateArtworkInput({
    mimeType: 'image/png',
    sizeBytes: MAX_ARTWORK_BYTES + 1,
  });
  assert.equal(result.ok, false);
});
