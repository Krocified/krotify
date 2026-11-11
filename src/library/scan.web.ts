import type { Asset } from 'expo-media-library';
import type { Track } from '../types';

export async function ensureAudioPermission(): Promise<boolean> {
  return false;
}

export async function scanLibrary(): Promise<{ tracks: Track[]; assets: Map<string, Asset> }> {
  return { tracks: [], assets: new Map() };
}
