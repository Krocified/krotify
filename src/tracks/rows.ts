import { titleFromFilename } from '../lib/format.ts';
import { hueFromSeed } from '../lib/hash.ts';
import type { NewOwnedTrack, ScanTrackInput, TrackRecord } from './types.ts';

export function scanRow(input: ScanTrackInput, now: number): TrackRecord {
  return {
    id: input.id,
    source: 'scan',
    location: input.location,
    fileName: input.fileName,
    sizeBytes: input.sizeBytes,
    durationMs: input.durationMs,
    title: titleFromFilename(input.fileName),
    artist: '',
    album: '',
    status: 'active',
    missing: 0,
    addedAt: now,
    lastSeenAt: now,
    artworkHue: hueFromSeed(input.fileName),
  };
}

export function ownedRow(input: NewOwnedTrack, id: string, now: number): TrackRecord {
  return {
    ...input,
    id,
    title: input.title || titleFromFilename(input.fileName),
    status: 'active',
    missing: 0,
    addedAt: now,
    lastSeenAt: now,
    artworkHue: input.artworkHue ?? hueFromSeed(input.fileName),
  };
}
