import { filterTracksByTag } from '../tags/filter.ts';
import { searchTracks } from './search.ts';
import type { Track } from '../types.ts';

export function pickerTracks(input: {
  tracks: readonly Track[];
  query: string;
  tagId: string | null;
  assignments: ReadonlyMap<string, readonly string[]>;
}): Track[] {
  const searched = searchTracks([...input.tracks], input.query);
  return filterTracksByTag(searched, input.tagId, input.assignments);
}

export function pickerSelectableIds(
  tracks: readonly Track[],
  existingIds: readonly string[],
): string[] {
  const existing = new Set(existingIds);
  return tracks.map((track) => track.id).filter((id) => !existing.has(id));
}
