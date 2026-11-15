import type { Track } from '../types';
import type { ImportFailure } from './imports';

export async function loadImportedTracks(): Promise<Track[]> {
  return [];
}

export async function pickAndImportTracks(): Promise<{
  tracks: Track[];
  failures: ImportFailure[];
}> {
  return { tracks: [], failures: [] };
}

export async function importTrackCopy(
  _track: Track,
): Promise<{ track: Track | null; failures: ImportFailure[] }> {
  return { track: null, failures: [] };
}

export async function removeImportedTrack(_id: string): Promise<void> {}

export async function deleteImportedFile(_uri: string): Promise<void> {}
