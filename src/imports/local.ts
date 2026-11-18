import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { importedFileName } from '../lib/importName.ts';
import { titleFromFilename } from '../lib/format.ts';
import type { ImportProgress } from '../lib/importProgress.ts';
import { storeOwnedFile } from '../storage/store.ts';
import {
  findOwnedByKey,
  getTrack,
  insertOwnedTrack,
  setTrackMissing,
  setTrackStatus,
  updateTrackFields,
} from '../tracks/repo.ts';
import { readTrackSeeds, saveSeedArtwork } from '../tracks/seed';
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

function errorText(error: unknown): string {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : typeof error === 'string' && error.trim()
        ? error.trim()
        : '';
  if (message) {
    if (/permission|SecurityException|MANAGE_DOCUMENTS|grantUriPermission/i.test(message)) {
      return 'The storage folder denied access. Choose the folder again in Settings.';
    }
    return message;
  }
  try {
    const detail = JSON.stringify(error);
    if (detail && detail !== '{}') return detail;
  } catch {}
  return 'Copy failed for an unknown reason.';
}

export type ImportOptions = {
  onProgress?: (progress: ImportProgress) => void;
  onAdded?: (record: TrackRecord) => void;
  onUpdated?: (record: TrackRecord) => void;
  signal?: AbortSignal;
};

export async function pickAndImportTracks(
  options: ImportOptions = {},
): Promise<ImportResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    multiple: true,
    copyToCacheDirectory: false,
  });
  if (picked.canceled) return { added: [], skipped: [], failures: [] };

  const added: TrackRecord[] = [];
  const skipped: ImportSkip[] = [];
  const failures: ImportFailure[] = [];
  const seeds = await readTrackSeeds(picked.assets.map((asset) => asset.uri));
  const total = picked.assets.length;

  for (const [index, asset] of picked.assets.entries()) {
    if (options.signal?.aborted) break;
    const name = importedFileName(asset.name, `track-${index + 1}.mp3`, asset.mimeType);
    options.onProgress?.({ index: index + 1, total, name });
    let copied: File | null = null;

    try {
      if (asset.mimeType && !isAudioMime(asset.mimeType)) {
        failures.push({
          name,
          reason: `Unsupported audio type: ${asset.mimeType}`,
        });
        continue;
      }

      const sourceSize = sourceSizeOf(asset.uri);
      if (!copyIsUsable(sourceSize)) {
        failures.push({
          name,
          reason: 'The selected file has no readable size.',
        });
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
        failures.push({
          name,
          reason: 'The copied file is empty. The provider returned no audio data.',
        });
        continue;
      }

      const seed = seeds.get(asset.uri) ?? {};
      const patch = seedToTrackPatch(seed, name);

      if (decision.kind === 'reactivate') {
        const durationMs = await probeDurationMs(copied.uri).catch(() => 0);
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
          durationMs: 0,
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
        options.onAdded?.(record);

        const location = copied.uri;
        const durationMs = await probeDurationMs(location).catch(() => 0);
        const artworkUri = await saveSeedArtwork(location);
        if (durationMs > 0 || artworkUri) {
          await updateTrackFields(record.id, {
            ...(durationMs > 0 ? { durationMs } : {}),
            ...(artworkUri ? { artworkUri } : {}),
          });
          const refreshed = await getTrack(record.id);
          if (refreshed) {
            const position = added.findIndex((item) => item.id === refreshed.id);
            if (position >= 0) added[position] = refreshed;
            options.onUpdated?.(refreshed);
          }
        }
      }
      copied = null;
    } catch (error) {
      discard(copied);
      failures.push({ name, reason: errorText(error) });
    }
  }

  return { added, skipped, failures };
}
