import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ARTWORK_BYTES, validateTagPatch } from '../src/lib/tagPatch.ts';

test('rejects an empty edit', () => {
  const result = validateTagPatch({});
  assert.equal(result.ok, false);
  assert.deepEqual(result.ok ? [] : result.errors, ['No tag changes provided.']);
});

test('rejects an edit with only undefined values', () => {
  const result = validateTagPatch({ title: undefined, year: undefined });
  assert.equal(result.ok, false);
});

test('accepts strings, integers and the explicit flag', () => {
  const result = validateTagPatch({
    title: '  Song  ',
    artist: 'Artist',
    album: 'Album',
    albumArtist: 'Album Artist',
    trackNumber: 3,
    discNumber: 1,
    year: 1999,
    genre: 'Pop',
    explicit: true,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok ? result.value : null, {
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    albumArtist: 'Album Artist',
    trackNumber: 3,
    discNumber: 1,
    year: 1999,
    genre: 'Pop',
    explicit: true,
  });
});

test('rejects non-integer year, track and disc values', () => {
  for (const key of ['year', 'trackNumber', 'discNumber'] as const) {
    for (const value of [1.5, Number.NaN, Number.POSITIVE_INFINITY, '3', null]) {
      const result = validateTagPatch({ [key]: value } as never);
      assert.equal(result.ok, false, `${key}=${String(value)}`);
    }
  }
});

test('rejects out of range track and disc numbers', () => {
  assert.equal(validateTagPatch({ trackNumber: 0 }).ok, false);
  assert.equal(validateTagPatch({ discNumber: -1 }).ok, false);
  assert.equal(validateTagPatch({ year: -2000 }).ok, false);
});

test('rejects non-boolean explicit values', () => {
  assert.equal(validateTagPatch({ explicit: 'yes' } as never).ok, false);
  assert.equal(validateTagPatch({ explicit: 1 } as never).ok, false);
});

test('rejects non-string text fields', () => {
  assert.equal(validateTagPatch({ title: 42 } as never).ok, false);
  assert.equal(validateTagPatch({ genre: ['pop'] } as never).ok, false);
});

test('accepts image artwork within the size limit', () => {
  const result = validateTagPatch({ title: 'Song' }, { mimeType: 'image/jpeg', sizeBytes: 1024 });
  assert.equal(result.ok, true);
});

test('accepts artwork as the only change', () => {
  const result = validateTagPatch({}, { mimeType: 'image/png', sizeBytes: 2048 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok ? result.value : null, {});
});

test('rejects non-image artwork', () => {
  const result = validateTagPatch({ title: 'Song' }, { mimeType: 'audio/mpeg', sizeBytes: 1024 });
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.errors.join(' '), /image/i);
});

test('rejects artwork over the size limit', () => {
  const result = validateTagPatch(
    { title: 'Song' },
    { mimeType: 'image/png', sizeBytes: MAX_ARTWORK_BYTES + 1 },
  );
  assert.equal(result.ok, false);
});

test('rejects invalid artwork sizes', () => {
  for (const sizeBytes of [0, -1, 1.5, Number.NaN]) {
    const result = validateTagPatch({ title: 'Song' }, { mimeType: 'image/png', sizeBytes });
    assert.equal(result.ok, false, `sizeBytes=${String(sizeBytes)}`);
  }
});

test('ignores keys outside TagFields', () => {
  const result = validateTagPatch({ title: 'Song', bogus: 'x' } as never);
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok ? result.value : null, { title: 'Song' });
});
