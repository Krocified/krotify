import type { TrackFieldPatch, TrackRecord } from './types.ts';

export type EditForm = {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  trackNumber: string;
  discNumber: string;
  year: string;
};

export type EditableTrack = Pick<
  TrackRecord,
  'title' | 'artist' | 'album' | 'albumArtist' | 'genre' | 'trackNumber' | 'discNumber' | 'year'
>;

type StringKey = 'title' | 'artist' | 'album' | 'albumArtist' | 'genre';
type NumberKey = 'trackNumber' | 'discNumber' | 'year';

const STRING_FIELDS: StringKey[] = ['title', 'artist', 'album', 'albumArtist', 'genre'];

const NUMBER_FIELDS: { key: NumberKey; label: string; min: number }[] = [
  { key: 'trackNumber', label: 'Track number', min: 1 },
  { key: 'discNumber', label: 'Disc number', min: 1 },
  { key: 'year', label: 'Year', min: 0 },
];

export function buildTrackFieldPatch(
  track: EditableTrack,
  form: EditForm,
  renameOnly: boolean,
): { patch: TrackFieldPatch; error?: string } {
  const patch: TrackFieldPatch = {};

  for (const key of STRING_FIELDS) {
    if (renameOnly && key !== 'title') continue;
    const value = form[key].trim();
    if (key === 'title' && value.length === 0) {
      return { patch, error: 'Title is required.' };
    }
    const current = (track[key] ?? '').trim();
    if (value !== current) patch[key] = value;
  }

  if (!renameOnly) {
    for (const { key, label, min } of NUMBER_FIELDS) {
      const raw = form[key].trim();
      if (raw.length === 0) continue;
      const value = Number(raw);
      if (!Number.isInteger(value)) {
        return { patch, error: `${label} must be a whole number.` };
      }
      if (value < min) {
        return {
          patch,
          error:
            min === 0 ? `${label} cannot be negative.` : `${label} must be at least 1.`,
        };
      }
      if (value !== track[key]) patch[key] = value;
    }
  }

  return { patch };
}
