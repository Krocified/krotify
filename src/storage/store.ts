import { Directory, File, Paths } from 'expo-file-system';
import { uniqueFileName } from './names.ts';
import { getStorageRoot } from './root.ts';
import type { StorageRoot } from './types.ts';

function ensureDirectory(directory: Directory): void {
  if (directory.uri.startsWith('content://')) return;
  if (!directory.exists) directory.create({ idempotent: true, intermediates: true });
}

function takenNames(directory: Directory): Set<string> {
  try {
    return new Set(directory.list().map((entry) => entry.name));
  } catch {
    return new Set();
  }
}

function discard(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {}
}

function mimeFor(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
    case 'aac':
      return 'audio/mp4';
    case 'flac':
      return 'audio/flac';
    case 'ogg':
    case 'opus':
      return 'audio/ogg';
    case 'wav':
      return 'audio/wav';
    default:
      return 'application/octet-stream';
  }
}

async function copyIntoContentDirectory(
  source: File,
  directory: Directory,
  name: string,
): Promise<File> {
  const destination = directory.createFile(name, source.type || mimeFor(name));
  try {
    await destination.write(await source.bytes());
    return destination;
  } catch (error) {
    discard(destination);
    throw error;
  }
}

export async function storeOwnedFile(
  sourceUri: string,
  fileName: string,
  root?: StorageRoot,
): Promise<File> {
  const targetRoot = root ?? (await getStorageRoot());
  const directory = new Directory(targetRoot.uri);
  ensureDirectory(directory);

  const name = uniqueFileName(fileName, takenNames(directory));
  const source = new File(sourceUri);

  if (targetRoot.uri.startsWith('content://')) {
    return copyIntoContentDirectory(source, directory, name);
  }

  const destination = new File(directory, name);
  await source.copy(destination);
  return destination;
}

export async function downloadOwnedFile(
  url: string,
  fileName: string,
  options: { signal?: AbortSignal; headers?: Record<string, string> } = {},
): Promise<File> {
  const root = await getStorageRoot();
  ensureDirectory(new Directory(root.uri));

  const cache = new File(Paths.cache, `download-${Date.now()}`);
  try {
    await File.downloadFileAsync(url, cache, {
      signal: options.signal,
      headers: options.headers,
    });
    return await storeOwnedFile(cache.uri, fileName, root);
  } finally {
    discard(cache);
  }
}
