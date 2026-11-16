import { File } from 'expo-file-system';
import type { Asset } from 'expo-media-library';
import type { Track } from '../types';
import { deleteTrackRecord, setTrackStatus } from './repo';

export async function clearTrack(id: string): Promise<void> {
  await setTrackStatus(id, 'removed');
}

function alreadyGone(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'ENOENT') return true;
  return error instanceof Error && /not found|no such file/i.test(error.message);
}

function deleteOwnedFileStrict(location: string): void {
  if (!location) return;
  const file = new File(location);
  if (!file.exists) return;
  try {
    file.delete();
  } catch (error) {
    if (alreadyGone(error)) return;
    throw error;
  }
}

export async function deleteTrackEverywhere(
  track: Track,
  assets: Map<string, Asset>,
): Promise<void> {
  if (track.source === 'scan') {
    const asset = assets.get(track.id);
    if (!asset) {
      throw new Error(`Media asset ${track.id} is no longer available.`);
    }
    await asset.delete();
  } else if (track.source !== 'demo') {
    deleteOwnedFileStrict(track.uri);
  }
  await deleteTrackRecord(track.id);
}
