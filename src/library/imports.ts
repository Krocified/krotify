import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import type { Track } from '../types';
import { titleFromFilename } from '../lib/format';
import { hashString, hueFromSeed } from '../lib/hash';

const KEY = 'krotify.imports.v1';
const PROBE_TIMEOUT_MS = 2000;

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

export async function pickAndImportTracks(): Promise<Track[]> {
  const picked = await File.pickFileAsync({ multipleFiles: true, mimeTypes: ['audio/*'] });
  if (picked.canceled) return [];

  const dir = new Directory(Paths.document, 'imports');
  dir.create({ idempotent: true, intermediates: true });

  const stored = await readTracks();
  const knownIds = new Set(stored.map((track) => track.id));
  const added: Track[] = [];
  const copied: File[] = [];
  const stamp = Date.now();

  for (const [index, file] of picked.result.entries()) {
    const id = `import:${hashString(file.name + ':' + (file.size ?? 0))}`;
    if (knownIds.has(id)) continue;
    const destination = new File(dir, `${stamp}-${index}-${file.name}`);
    try {
      await file.copy(destination);
      copied.push(destination);
      const uri = destination.uri;
      added.push({
        id,
        uri,
        source: 'import',
        title: titleFromFilename(file.name),
        artist: '',
        album: '',
        durationMs: await probeDurationMs(uri),
        artworkHue: hueFromSeed(file.name),
      });
      knownIds.add(id);
    } catch {
      await discardFile(destination);
    }
  }

  if (added.length > 0) {
    try {
      await writeTracks([...stored, ...added]);
    } catch (error) {
      await Promise.all(copied.map(discardFile));
      throw error;
    }
  }
  return added;
}

export async function removeImportedTrack(id: string): Promise<void> {
  const stored = await readTracks();
  await writeTracks(stored.filter((track) => track.id !== id));
}

export async function deleteImportedFile(uri: string): Promise<void> {
  const file = new File(uri);
  if (file.exists) file.delete();
}
