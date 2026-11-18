import assert from 'node:assert/strict';
import test from 'node:test';
import { pickerSelectableIds, pickerTracks } from '../src/lib/playlistPicker.ts';
import type { Track } from '../src/types.ts';

const track = (id: string, title: string, artist = ''): Track => ({
  id,
  uri: `file:///${id}.mp3`,
  source: 'scan',
  missing: 0,
  title,
  artist,
  album: '',
  durationMs: 1000,
  artworkHue: 0,
});

test('filters by search and tag together', () => {
  const tracks = [track('a', 'Blue Sky', 'Mira'), track('b', 'Red Sky', 'Kite')];
  const assignments = new Map([['a', ['t1']], ['b', ['t2']]]);
  assert.deepEqual(
    pickerTracks({ tracks, query: 'blue', tagId: null, assignments }).map((t) => t.id),
    ['a'],
  );
  assert.deepEqual(
    pickerTracks({ tracks, query: '', tagId: 't2', assignments }).map((t) => t.id),
    ['b'],
  );
  assert.deepEqual(pickerTracks({ tracks, query: '', tagId: null, assignments }).length, 2);
});

test('existing ids are not selectable and preserve order', () => {
  const tracks = [track('a', 'A'), track('b', 'B'), track('c', 'C')];
  assert.deepEqual(pickerSelectableIds(tracks, ['b']), ['a', 'c']);
});
