import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track } from '../types';

const KEY = 'krotify.excluded.v1';

async function readTracks(): Promise<Track[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Track => typeof item === 'object' && item !== null && typeof (item as Track).id === 'string',
    );
  } catch {
    return [];
  }
}

async function writeTracks(tracks: Track[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(tracks));
}

export async function loadExcludedTracks(): Promise<Track[]> {
  return readTracks();
}

export async function excludeTrack(track: Track): Promise<Track[]> {
  const stored = await readTracks();
  const next = stored.some((item) => item.id === track.id) ? stored : [...stored, track];
  await writeTracks(next);
  return next;
}

export async function restoreTrack(id: string): Promise<Track[]> {
  const stored = await readTracks();
  const next = stored.filter((track) => track.id !== id);
  await writeTracks(next);
  return next;
}
