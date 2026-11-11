import type { Track } from '../types';

export type TrackMetadata = {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: number;
  trackNumber?: number;
  genre?: string;
  artworkUri?: string;
};

export async function enrichTracks(
  tracks: Track[],
  _getUri: (track: Track) => Promise<string | null>,
  _onBatch: (updated: Track[]) => void,
): Promise<Track[]> {
  return tracks;
}

export async function loadArtwork(_track: Track): Promise<string | null> {
  return null;
}
