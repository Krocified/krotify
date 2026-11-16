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
  genre: '',
  year: '',
  ...overrides,
});

test('patches changed string fields', () => {
  const result = buildTrackFieldPatch(
    track,
    form({ title: 'New Title', artist: 'Another Artist', album: 'Another Album' }),
  );
  assert.deepEqual(result, {
    patch: { title: 'New Title', artist: 'Another Artist', album: 'Another Album' },
  });
});

test('an empty title is rejected', () => {
  const result = buildTrackFieldPatch(track, form({ title: '   ' }));
  assert.equal(result.error, 'Title is required.');
});

test('unchanged fields are omitted', () => {
  const result = buildTrackFieldPatch(track, form({ title: ' Old Title ' }));
  assert.deepEqual(result, { patch: {} });
});

test('patches a whole-number year', () => {
  const result = buildTrackFieldPatch(track, form({ year: '1999' }));
  assert.deepEqual(result, { patch: { year: 1999 } });
});

test('rejects a fractional year', () => {
  const result = buildTrackFieldPatch(track, form({ year: '19.5' }));
  assert.equal(result.error, 'Year must be a whole number.');
});

test('rejects a negative year', () => {
  const result = buildTrackFieldPatch(track, form({ year: '-1' }));
  assert.equal(result.error, 'Year cannot be negative.');
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
