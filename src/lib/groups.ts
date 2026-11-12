import type { Track } from '../types';
import { hueFromSeed } from './hash.ts';

export type Album = {
  key: string;
  title: string;
  artist: string;
  tracks: Track[];
  artworkHue: number;
};

export type Artist = {
  key: string;
  name: string;
  tracks: Track[];
  albumCount: number;
};

const UNKNOWN_ALBUM = 'Unknown Album';
const UNKNOWN_ARTIST = 'Unknown Artist';

function albumName(track: Track): string {
  return track.album.trim() || UNKNOWN_ALBUM;
}

function artistName(track: Track): string {
  return track.artist.trim() || UNKNOWN_ARTIST;
}

function albumArtistName(track: Track): string {
  return track.albumArtist?.trim() || artistName(track);
}

function compareTracks(a: Track, b: Track): number {
  if (a.trackNumber != null && b.trackNumber != null && a.trackNumber !== b.trackNumber) {
    return a.trackNumber - b.trackNumber;
  }
  if (a.trackNumber != null && b.trackNumber == null) return -1;
  if (a.trackNumber == null && b.trackNumber != null) return 1;
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

export function buildAlbums(tracks: Track[]): Album[] {
  const albums = new Map<string, Album>();
  for (const track of tracks) {
    const title = albumName(track);
    const artist = albumArtistName(track);
    const key = `${artist}|${title}`;
    const existing = albums.get(key);
    if (existing) {
      existing.tracks.push(track);
    } else {
      albums.set(key, { key, title, artist, tracks: [track], artworkHue: hueFromSeed(key) });
    }
  }
  for (const album of albums.values()) album.tracks.sort(compareTracks);
  return [...albums.values()].sort(
    (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || a.artist.localeCompare(b.artist, undefined, { sensitivity: 'base' }),
  );
}

export function buildArtists(tracks: Track[]): Artist[] {
  const artists = new Map<string, Artist & { albums: Set<string> }>();
  for (const track of tracks) {
    const name = artistName(track);
    const key = name;
    let artist = artists.get(key);
    if (!artist) {
      artist = { key, name, tracks: [], albumCount: 0, albums: new Set() };
      artists.set(key, artist);
    }
    artist.tracks.push(track);
    artist.albums.add(albumName(track));
  }
  return [...artists.values()]
    .map(({ albums, ...artist }) => ({
      ...artist,
      albumCount: albums.size,
      tracks: artist.tracks.sort(compareTracks),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
