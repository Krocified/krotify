import type { TrackFieldPatch, TrackRecord } from './types.ts';

export type EditForm = {
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: string;
};

export type EditableTrack = Pick<
  TrackRecord,
  'title' | 'artist' | 'album' | 'genre' | 'year'
>;

type StringKey = 'title' | 'artist' | 'album' | 'genre';

const STRING_FIELDS: StringKey[] = ['title', 'artist', 'album', 'genre'];

export function buildTrackFieldPatch(
  track: EditableTrack,
  form: EditForm,
): { patch: TrackFieldPatch; error?: string } {
  const patch: TrackFieldPatch = {};

  for (const key of STRING_FIELDS) {
    const value = form[key].trim();
    if (key === 'title' && value.length === 0) {
      return { patch, error: 'Title is required.' };
    }
    const current = (track[key] ?? '').trim();
    if (value !== current) patch[key] = value;
  }

  const raw = form.year.trim();
  if (raw.length > 0) {
    const value = Number(raw);
    if (!Number.isInteger(value)) {
      return { patch, error: 'Year must be a whole number.' };
    }
    if (value < 0) {
      return { patch, error: 'Year cannot be negative.' };
    }
    if (value !== track.year) patch.year = value;
  }

  return { patch };
}
