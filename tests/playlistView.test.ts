import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hueFromSeed } from '../src/lib/hash.ts';
import { playlistArtwork } from '../src/lib/playlistView.ts';
import type { Track } from '../src/types.ts';

const track: Track = {
  id: 't1',
  uri: 'file:///a.mp3',
  source: 'import',
  missing: 0,
  title: 'A',
  artist: '',
  album: '',
  durationMs: 1000,
  artworkHue: 0,
};

test('playlistArtwork prefers the picked cover', () => {
  assert.deepEqual(
    playlistArtwork({ id: 'p', name: 'Road', createdAt: 1, artworkUri: 'file:///cover.jpg' }, []),
    { uri: 'file:///cover.jpg', hue: hueFromSeed('pRoad') },
  );
});

test('playlistArtwork falls back to the first track artwork', () => {
  const result = playlistArtwork({ id: 'p', name: 'Road', createdAt: 1 }, [
    track,
    { ...track, id: 't2', artworkUri: 'file:///a.jpg' },
    { ...track, id: 't3', artworkUri: 'file:///b.jpg' },
  ]);
  assert.equal(result.uri, 'file:///a.jpg');
  assert.equal(result.hue, hueFromSeed('pRoad'));
});

test('playlistArtwork falls back to the hashed hue', () => {
  const result = playlistArtwork({ id: 'p', name: 'Road', createdAt: 1 }, []);
  assert.equal(result.uri, undefined);
  assert.equal(result.hue, hueFromSeed('pRoad'));
});
