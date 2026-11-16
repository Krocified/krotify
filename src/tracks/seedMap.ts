import { titleFromFilename } from '../lib/format.ts';
import type { TrackFieldPatch } from './types.ts';

export type TrackSeed = {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  trackNumber?: number;
  discNumber?: number;
  year?: number;
  genre?: string;
  artworkUri?: string;
};

function text(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function count(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function seedToTrackPatch(seed: TrackSeed, fileName: string): TrackFieldPatch {
  const patch: TrackFieldPatch = {
    title: text(seed.title) ?? titleFromFilename(fileName),
    artist: text(seed.artist),
    album: text(seed.album),
    albumArtist: text(seed.albumArtist),
    trackNumber: count(seed.trackNumber),
    discNumber: count(seed.discNumber),
    year: count(seed.year),
    genre: text(seed.genre),
    artworkUri: text(seed.artworkUri),
  };
  for (const key of Object.keys(patch) as (keyof TrackFieldPatch)[]) {
    if (patch[key] === undefined) delete patch[key];
  }
  return patch;
}
