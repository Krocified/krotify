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

export async function storeOwnedFile(
  sourceUri: string,
  fileName: string,
  root?: StorageRoot,
): Promise<File> {
  const targetRoot = root ?? (await getStorageRoot());
  const directory = new Directory(targetRoot.uri);
  ensureDirectory(directory);

  const name = uniqueFileName(fileName, takenNames(directory));
  const destination = new File(directory, name);
  await new File(sourceUri).copy(destination);
  return destination;
}

export async function downloadOwnedFile(
  url: string,
  fileName: string,
  options: { signal?: AbortSignal; headers?: Record<string, string> } = {},
): Promise<File> {
  const root = await getStorageRoot();
  const directory = new Directory(root.uri);
  ensureDirectory(directory);

  const name = uniqueFileName(fileName, takenNames(directory));
  const destination = new File(directory, name);

  try {
    return await File.downloadFileAsync(url, destination, {
      signal: options.signal,
      headers: options.headers,
    });
  } catch (error) {
    if (
      options.signal?.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      discard(destination);
      throw error;
    }

    discard(destination);
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
}
