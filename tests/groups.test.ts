import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAlbums, buildArtists } from '../src/lib/groups.ts';
import type { Track } from '../src/types.ts';

let seq = 0;
const track = (overrides: Partial<Track>): Track => ({
  id: `t${seq++}`,
  uri: `file:///${seq}.mp3`,
  source: 'scan',
  title: 'Track',
  artist: '',
  album: '',
  durationMs: 1_000,
  artworkHue: 0,
  ...overrides,
});

test('buildAlbums keys by artist and album', () => {
  const albums = buildAlbums([
    track({ title: 'One', artist: 'A', album: 'Blue' }),
    track({ title: 'Two', artist: 'A', album: 'Blue' }),
    track({ title: 'Three', artist: 'B', album: 'Blue' }),
  ]);
  assert.equal(albums.length, 2);
  const a = albums.find((album) => album.artist === 'A');
  assert.ok(a);
  assert.equal(a.key, 'A|Blue');
  assert.equal(a.title, 'Blue');
  assert.equal(a.tracks.length, 2);
  const b = albums.find((album) => album.artist === 'B');
  assert.ok(b);
  assert.equal(b.tracks.length, 1);
});

test('buildAlbums falls back to unknown album and artist', () => {
  const albums = buildAlbums([track({ title: 'Loose' })]);
  assert.equal(albums.length, 1);
  assert.equal(albums[0].title, 'Unknown Album');
  assert.equal(albums[0].artist, 'Unknown Artist');
  assert.equal(albums[0].key, 'Unknown Artist|Unknown Album');
});

test('buildAlbums sorts by album title', () => {
  const albums = buildAlbums([
    track({ artist: 'A', album: 'Zebra' }),
    track({ artist: 'A', album: 'apple' }),
    track({ artist: 'A', album: 'Mango' }),
  ]);
  assert.deepEqual(albums.map((album) => album.title), ['apple', 'Mango', 'Zebra']);
});

test('buildArtists groups and counts distinct albums', () => {
  const artists = buildArtists([
    track({ artist: 'A', album: 'One' }),
    track({ artist: 'A', album: 'One' }),
    track({ artist: 'A', album: 'Two' }),
    track({ artist: 'B', album: '' }),
    track({ artist: '', album: '' }),
  ]);
  assert.deepEqual(
    artists.map((artist) => artist.name),
    ['A', 'B', 'Unknown Artist'],
  );
  assert.equal(artists.find((artist) => artist.name === 'A')?.albumCount, 2);
  assert.equal(artists.find((artist) => artist.name === 'B')?.albumCount, 1);
  assert.equal(artists.find((artist) => artist.name === 'Unknown Artist')?.albumCount, 1);
  assert.equal(artists.find((artist) => artist.name === 'A')?.tracks.length, 3);
});

test('buildAlbums groups by albumArtist when set', () => {
  const albums = buildAlbums([
    track({ title: 'One', artist: 'Guest', albumArtist: 'Main', album: 'Record' }),
    track({ title: 'Two', artist: 'Main', album: 'Record' }),
  ]);
  assert.equal(albums.length, 1);
  assert.equal(albums[0].artist, 'Main');
  assert.equal(albums[0].key, 'Main|Record');
  assert.equal(albums[0].tracks.length, 2);
});

test('album and artist detail tracks sort by track number then title', () => {
  const albums = buildAlbums([
    track({ title: 'B', artist: 'A', album: 'Record', trackNumber: 2 }),
    track({ title: 'C', artist: 'A', album: 'Record' }),
    track({ title: 'A', artist: 'A', album: 'Record', trackNumber: 1 }),
  ]);
  assert.deepEqual(albums[0].tracks.map((item) => item.title), ['A', 'B', 'C']);

  const artists = buildArtists([
    track({ title: 'B', artist: 'A', album: 'Record', trackNumber: 2 }),
    track({ title: 'C', artist: 'A', album: 'Record' }),
    track({ title: 'A', artist: 'A', album: 'Record', trackNumber: 1 }),
  ]);
  assert.deepEqual(artists[0].tracks.map((item) => item.title), ['A', 'B', 'C']);
});
