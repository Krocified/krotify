import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import type { Track } from '../types';
import { titleFromFilename } from '../lib/format';
import { hashString, hueFromSeed } from '../lib/hash';
import { importedFileName } from '../lib/importName';

const KEY = 'krotify.imports.v1';
const PROBE_TIMEOUT_MS = 2000;

export type ImportFailure = { name: string; reason: string };

export type ImportBatch = { tracks: Track[]; failures: ImportFailure[] };

export type ImportCopy = { track: Track | null; failures: ImportFailure[] };

async function readTracks(): Promise<Track[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Track =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Track).id === 'string' &&
        (item as Track).source === 'import',
    );
  } catch {
    return [];
  }
}

async function writeTracks(tracks: Track[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(tracks));
}

function probeDurationMs(uri: string): Promise<number> {
  return new Promise((resolve) => {
    const player = createAudioPlayer(uri, { updateInterval: 100 });
    let subscription: { remove(): void } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const finish = (ms: number) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      subscription?.remove();
      player.remove();
      resolve(ms);
    };

    subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.isLoaded) finish(Math.round((status.duration ?? 0) * 1000));
    });
    timer = setTimeout(() => finish(0), PROBE_TIMEOUT_MS);
  });
}

export async function loadImportedTracks(): Promise<Track[]> {
  return readTracks();
}

async function discardFile(file: File): Promise<void> {
  try {
    if (file.exists) file.delete();
  } catch {
  }
}

async function discardFolder(folder: Directory, file: File): Promise<void> {
  await discardFile(file);
  try {
    if (folder.exists) folder.delete();
  } catch {
  }
}

function mediaType(mime: string): string {
  return mime.split(';')[0]?.trim().toLowerCase() ?? '';
}

function isAudioMime(mime: string): boolean {
  const type = mediaType(mime);
  return type === '' || type === 'application/octet-stream' || type.startsWith('audio/');
}

export async function pickAndImportTracks(): Promise<ImportBatch> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return { tracks: [], failures: [] };

  const dir = new Directory(Paths.document, 'imports');
  dir.create({ idempotent: true, intermediates: true });

  const stored = await readTracks();
  const knownIds = new Set(stored.map((track) => track.id));
  const added: Track[] = [];
  const failures: ImportFailure[] = [];
  const copied: File[] = [];
  const stamp = Date.now();

  for (const [index, asset] of picked.assets.entries()) {
    const name = importedFileName(asset.name, `track-${index + 1}.mp3`, asset.mimeType);
    const reportedSize =
      typeof asset.size === 'number' && asset.size > 0 ? asset.size : null;
    const folder = new Directory(dir, `${stamp}-${index}`);
    const destination = new File(folder, name);
    let reason: string | null = null;

    try {
      if (asset.mimeType && !isAudioMime(asset.mimeType)) {
        reason = 'unsupported';
      } else {
        folder.create({ idempotent: true, intermediates: true });
        await new File(asset.uri).copy(destination);
        if (!destination.exists || destination.size <= 0) {
          reason = 'no audio data';
        } else if (reportedSize !== null && destination.size !== reportedSize) {
          reason = 'copy failed';
        }
      }
    } catch {
      reason = 'copy failed';
    }

    if (reason !== null) {
      await discardFolder(folder, destination);
      failures.push({ name, reason });
      continue;
    }

    const key = reportedSize !== null
      ? name + ':' + reportedSize
      : name + ':' + destination.size + ':' + asset.uri + ':' + stamp;
    const id = `import:${hashString(key)}`;
    if (knownIds.has(id)) {
      await discardFolder(folder, destination);
      continue;
    }

    const uri = destination.uri;
    added.push({
      id,
      uri,
      source: 'import',
      title: titleFromFilename(name),
      artist: '',
      album: '',
      durationMs: await probeDurationMs(uri),
      artworkHue: hueFromSeed(name),
    });
    knownIds.add(id);
    copied.push(destination);
  }

  if (added.length > 0) {
    try {
      await writeTracks([...stored, ...added]);
    } catch (error) {
      await Promise.all(copied.map(discardFile));
      throw error;
    }
  }
  return { tracks: added, failures };
}

export async function importTrackCopy(track: Track): Promise<ImportCopy> {
  if (!track.uri.startsWith('file://')) {
    const result = await pickAndImportTracks();
    return { track: result.tracks[0] ?? null, failures: result.failures };
  }

  const source = new File(track.uri);
  if (!source.exists) {
    const result = await pickAndImportTracks();
    return { track: result.tracks[0] ?? null, failures: result.failures };
  }

  const name = importedFileName(source.name, 'track.mp3');
  const id = `import:${hashString(name + ':' + source.size)}`;
  const stored = await readTracks();
  const existing = stored.find((item) => item.id === id);
  if (existing) return { track: existing, failures: [] };

  const dir = new Directory(Paths.document, 'imports');
  dir.create({ idempotent: true, intermediates: true });
  const folder = new Directory(dir, `${Date.now()}-copy`);
  const destination = new File(folder, name);

  try {
    folder.create({ idempotent: true, intermediates: true });
    await source.copy(destination);
    if (!destination.exists || destination.size <= 0) {
      await discardFolder(folder, destination);
      return { track: null, failures: [{ name, reason: 'no audio data' }] };
    }
    const uri = destination.uri;
    const imported: Track = {
      ...track,
      id,
      uri,
      source: 'import',
      title: track.title || titleFromFilename(name),
      durationMs: track.durationMs || (await probeDurationMs(uri)),
    };
    await writeTracks([...stored, imported]);
    return { track: imported, failures: [] };
  } catch {
    await discardFolder(folder, destination);
    return { track: null, failures: [{ name, reason: 'copy failed' }] };
  }
}

export async function removeImportedTrack(id: string): Promise<void> {
  const stored = await readTracks();
  await writeTracks(stored.filter((track) => track.id !== id));
}

export async function deleteImportedFile(uri: string): Promise<void> {
  const file = new File(uri);
  if (!file.exists) return;
  const parent = file.parentDirectory;
  file.delete();
  try {
    if (parent.uri.includes('/imports/') && parent.exists) parent.delete();
  } catch {
  }
}
