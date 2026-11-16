import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedToTrackPatch } from '../src/tracks/seedMap.ts';

test('seeding prefers embedded tags over the filename', () => {
  const patch = seedToTrackPatch(
    {
      title: 'Blue Monday',
      artist: 'New Order',
      album: 'Power, Corruption & Lies',
      albumArtist: 'New Order',
      trackNumber: 3,
      discNumber: 1,
      year: 1983,
      genre: 'Synth-pop',
      artworkUri: 'file:///artwork/0123456789abcdef.jpg',
    },
    '03 - Blue Monday.mp3',
  );
  assert.deepEqual(patch, {
    title: 'Blue Monday',
    artist: 'New Order',
    album: 'Power, Corruption & Lies',
    albumArtist: 'New Order',
    trackNumber: 3,
    discNumber: 1,
    year: 1983,
    genre: 'Synth-pop',
    artworkUri: 'file:///artwork/0123456789abcdef.jpg',
  });
});

test('seeding falls back to the filename title', () => {
  const patch = seedToTrackPatch({}, '03 - Blue Monday.mp3');
  assert.equal(patch.title, 'Blue Monday');
  assert.equal('artist' in patch, false);
  assert.equal('album' in patch, false);
});

test('seeding omits artwork when the file has none', () => {
  const patch = seedToTrackPatch({ title: 'Blue Monday' }, '03 - Blue Monday.mp3');
  assert.equal('artworkUri' in patch, false);
});

test('seeding never sets explicit', () => {
  const patch = seedToTrackPatch(
    {
      title: 'Blue Monday',
      artist: 'New Order',
      album: 'Power, Corruption & Lies',
      albumArtist: 'New Order',
      trackNumber: 3,
      discNumber: 1,
      year: 1983,
      genre: 'Synth-pop',
      artworkUri: 'file:///artwork/0123456789abcdef.jpg',
    },
    '03 - Blue Monday.mp3',
  );
  assert.equal('explicit' in patch, false);
});

test('seeding trims strings and drops blank values', () => {
  const patch = seedToTrackPatch(
    { title: '   ', artist: '  New Order  ', album: '', genre: '   ', artworkUri: '  ' },
    '03 - Blue Monday.mp3',
  );
  assert.equal(patch.title, 'Blue Monday');
  assert.equal(patch.artist, 'New Order');
  assert.equal('album' in patch, false);
  assert.equal('genre' in patch, false);
  assert.equal('artworkUri' in patch, false);
});

test('seeding keeps only finite numbers', () => {
  const patch = seedToTrackPatch(
    {
      trackNumber: Number.POSITIVE_INFINITY,
      discNumber: Number.NaN,
      year: 1983,
    },
    '03 - Blue Monday.mp3',
  );
  assert.equal('trackNumber' in patch, false);
  assert.equal('discNumber' in patch, false);
  assert.equal(patch.year, 1983);
});
