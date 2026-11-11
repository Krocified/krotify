import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearch, searchTracks } from '../src/lib/search.ts';
import type { Track } from '../src/types.ts';

const track = (id: string, title: string, artist = '', album = ''): Track => ({
  id,
  uri: `file:///${id}.mp3`,
  source: 'scan',
  title,
  artist,
  album,
  durationMs: 1_000,
  artworkHue: 0,
});

const library = [
  track('1', 'Jóga', 'Björk', 'Homogenic'),
  track('2', 'Teardrop', 'Massive Attack', 'Mezzanine'),
  track('3', 'Blue Monday', 'New Order', 'Power, Corruption & Lies'),
];

test('normalizeSearch folds case, accents and whitespace', () => {
  assert.equal(normalizeSearch('  BJÖRK   '), 'bjork');
  assert.equal(normalizeSearch('Jóga'), 'joga');
});

test('searchTracks matches title, artist and album', () => {
  assert.deepEqual(searchTracks(library, 'bjork').map((t) => t.id), ['1']);
  assert.deepEqual(searchTracks(library, 'joga').map((t) => t.id), ['1']);
  assert.deepEqual(searchTracks(library, 'mezzanine').map((t) => t.id), ['2']);
  assert.deepEqual(searchTracks(library, 'mon').map((t) => t.id), ['3']);
});

test('searchTracks returns the same list for an empty query', () => {
  assert.equal(searchTracks(library, ''), library);
  assert.equal(searchTracks(library, '   '), library);
});

test('searchTracks preserves order', () => {
  assert.deepEqual(searchTracks(library, 'o').map((t) => t.id), ['1', '2', '3']);
});
