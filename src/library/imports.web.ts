import type { Track } from '../types';

export async function loadImportedTracks(): Promise<Track[]> {
  return [];
}

export async function pickAndImportTracks(): Promise<Track[]> {
  return [];
}

export async function removeImportedTrack(_id: string): Promise<void> {}

export async function deleteImportedFile(_uri: string): Promise<void> {}
