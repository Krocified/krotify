import assert from 'node:assert/strict';
import test from 'node:test';
import { appendPositions, bulkAddMessage, tracksToAppend } from '../src/lib/playlistAdd.ts';

test('tracksToAppend drops existing and duplicate ids and keeps order', () => {
  assert.deepEqual(tracksToAppend(['a'], ['b', 'a', 'b', 'c']), ['b', 'c']);
  assert.deepEqual(tracksToAppend([], ['z', 'y']), ['z', 'y']);
});

test('appendPositions continues the gap-numbered sequence', () => {
  assert.deepEqual(appendPositions(0, 2), [1000, 2000]);
  assert.deepEqual(appendPositions(4000, 1), [5000]);
  assert.deepEqual(appendPositions(0, 0), []);
});

test('bulkAddMessage counts tracks, playlists and failures', () => {
  assert.equal(bulkAddMessage(3, 2, []), 'Added 3 songs to 2 playlists');
  assert.equal(bulkAddMessage(1, 1, []), 'Added 1 song to 1 playlist');
  assert.equal(bulkAddMessage(2, 2, ['Roadtrip']), 'Added 2 songs to 1 playlist. Failed: Roadtrip');
});
