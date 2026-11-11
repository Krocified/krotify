import type { Track } from '../types';

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchTracks(tracks: Track[], query: string): Track[] {
  const needle = normalizeSearch(query);
  if (!needle) return tracks;
  return tracks.filter((track) =>
    [track.title, track.artist, track.album].some((field) => normalizeSearch(field).includes(needle)),
  );
}
