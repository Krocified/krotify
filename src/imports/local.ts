import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { importedFileName } from '../lib/importName.ts';
import { titleFromFilename } from '../lib/format.ts';
import { storeOwnedFile } from '../storage/store.ts';
import {
  findOwnedByKey,
  getTrack,
  insertOwnedTrack,
  setTrackMissing,
  setTrackStatus,
  updateTrackFields,
} from '../tracks/repo.ts';
import { readTrackSeed } from '../tracks/seed.ts';
import { seedToTrackPatch } from '../tracks/seedMap.ts';
import type { TrackRecord } from '../tracks/types.ts';
import {
  copyIsUsable,
  decideImport,
  type ImportFailure,
  type ImportResult,
  type ImportSkip,
} from './plan.ts';
import { probeDurationMs } from './probe.ts';

export type { ImportFailure } from './plan.ts';

function mediaType(mime: string): string {
  return mime.split(';')[0]?.trim().toLowerCase() ?? '';
}

function isAudioMime(mime: string): boolean {
  const type = mediaType(mime);
  return type === '' || type === 'application/octet-stream' || type.startsWith('audio/');
}

function discard(file: File | null): void {
  if (!file) return;
  try {
    if (file.exists) file.delete();
  } catch {
  }
}

function sourceSizeOf(uri: string): number {
  try {
    return new File(uri).size;
  } catch {
    return Number.NaN;
  }
}

function locationExists(location: string): boolean {
  try {
    return new File(location).exists;
  } catch {
    return false;
  }
}

export async function pickAndImportTracks(): Promise<ImportResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return { added: [], skipped: [], failures: [] };

  const added: TrackRecord[] = [];
  const skipped: ImportSkip[] = [];
  const failures: ImportFailure[] = [];

  for (const [index, asset] of picked.assets.entries()) {
    const name = importedFileName(asset.name, `track-${index + 1}.mp3`, asset.mimeType);
    let copied: File | null = null;

    try {
      if (asset.mimeType && !isAudioMime(asset.mimeType)) {
        failures.push({ name, reason: 'unsupported' });
        continue;
      }

      const sourceSize = sourceSizeOf(asset.uri);
      if (!copyIsUsable(sourceSize)) {
        failures.push({ name, reason: 'no audio data' });
        continue;
      }

      const existing = await findOwnedByKey(name, sourceSize);
      const decision = decideImport(
        existing ? [existing] : [],
        { fileName: name, sizeBytes: sourceSize },
        locationExists,
      );

      if (decision.kind === 'duplicate') {
        skipped.push({ name, reason: 'duplicate' });
        continue;
      }
      if (decision.kind === 'hidden') {
        skipped.push({ name, reason: 'hidden' });
        continue;
      }

      if (decision.kind === 'reactivate' && decision.reuseFile && existing) {
        await updateTrackFields(decision.id, {
          location: existing.location,
          fileName: name,
          sizeBytes: sourceSize,
        });
        await setTrackMissing(decision.id, false);
        await setTrackStatus(decision.id, 'active');
        const refreshed = await getTrack(decision.id);
        if (refreshed) added.push(refreshed);
        continue;
      }

      copied = await storeOwnedFile(asset.uri, name);
      if (!copyIsUsable(copied.size)) {
        discard(copied);
        copied = null;
        failures.push({ name, reason: 'no audio data' });
        continue;
      }

      const durationMs = await probeDurationMs(copied.uri).catch(() => 0);
      const seed = await readTrackSeed(copied.uri);
      const patch = seedToTrackPatch(seed, name);

      if (decision.kind === 'reactivate') {
        await updateTrackFields(decision.id, {
          ...patch,
          location: copied.uri,
          fileName: copied.name,
          sizeBytes: copied.size,
          durationMs,
        });
        await setTrackMissing(decision.id, false);
        await setTrackStatus(decision.id, 'active');
        const refreshed = await getTrack(decision.id);
        if (refreshed) added.push(refreshed);
      } else {
        const record = await insertOwnedTrack({
          source: 'import',
          location: copied.uri,
          fileName: copied.name,
          sizeBytes: copied.size,
          durationMs,
          title: patch.title ?? titleFromFilename(name),
          artist: patch.artist ?? '',
          album: patch.album ?? '',
          albumArtist: patch.albumArtist,
          trackNumber: patch.trackNumber,
          discNumber: patch.discNumber,
          year: patch.year,
          genre: patch.genre,
          artworkUri: patch.artworkUri,
        });
        added.push(record);
      }
      copied = null;
    } catch {
      discard(copied);
      failures.push({ name, reason: 'copy failed' });
    }
  }

  return { added, skipped, failures };
}
