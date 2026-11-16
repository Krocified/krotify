import { File } from 'expo-file-system';
import type { Asset } from 'expo-media-library';
import type { Track } from '../types';

export class MissingFileError extends Error {
  constructor(readonly trackId: string) {
    super('File missing');
    this.name = 'MissingFileError';
  }
}

export function isMissingFileError(error: unknown): error is MissingFileError {
  return error instanceof MissingFileError;
}

export async function resolvePlaybackUri(
  track: Track,
  assets: Map<string, Asset>,
): Promise<string> {
  if (track.source === 'scan') {
    const asset = assets.get(track.id);
    const uri = track.uri || (asset ? await asset.getUri() : '');
    if (!uri) throw new MissingFileError(track.id);
    if (uri.startsWith('content://')) return uri;
    if (!new File(uri).exists) throw new MissingFileError(track.id);
    return uri;
  }
  if (!track.uri || !new File(track.uri).exists) throw new MissingFileError(track.id);
  return track.uri;
}
