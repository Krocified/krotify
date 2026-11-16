import type { Asset } from 'expo-media-library';
import type { ScanTrackInput } from '../tracks/types';

export async function ensureAudioPermission(): Promise<boolean> {
  return false;
}

export async function scanLibrary(): Promise<{
  candidates: ScanTrackInput[];
  assets: Map<string, Asset>;
}> {
  return { candidates: [], assets: new Map() };
}
