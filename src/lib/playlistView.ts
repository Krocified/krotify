import type { Playlist } from '../db/repo';
import type { Track } from '../types';
import { hueFromSeed } from './hash.ts';

export type PlaylistArtwork = {
  uri?: string;
  hue: number;
};

export function playlistArtwork(playlist: Playlist, tracks: Track[]): PlaylistArtwork {
  const hue = hueFromSeed(playlist.id + playlist.name);
  if (playlist.artworkUri) return { uri: playlist.artworkUri, hue };
  const fallback = tracks.find((track) => Boolean(track.artworkUri));
  if (fallback?.artworkUri) return { uri: fallback.artworkUri, hue };
  return { hue };
}
