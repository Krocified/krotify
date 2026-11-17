import { Directory, File, Paths } from 'expo-file-system';
import { getSetting, putSetting } from '../db/settings.ts';
import {
  deleteTrackRecord,
  findTrackByLocation,
  listRemovedOwnedTracks,
  updateTrackFields,
} from '../tracks/repo.ts';
import { uniqueFileName } from './names.ts';
import type { StorageRoot } from './types.ts';

const ROOT_URI_KEY = 'storageRootUri';
const ROOT_NAME_KEY = 'storageRootName';
const ROOT_KIND_KEY = 'storageRootKind';
const DEFAULT_ROOT_NAME = 'Krotify';
const LEGACY_ROOT_NAME = 'imports';

type MoveResult = {
  moved: number;
  failures: { name: string; reason: string }[];
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function storedKind(root: StorageRoot): string {
  if (root.kind === 'picked') return 'picked';
  return root.name === LEGACY_ROOT_NAME ? 'legacy' : 'krotify';
}

async function persistRoot(root: StorageRoot): Promise<void> {
  await putSetting(ROOT_URI_KEY, root.uri);
  await putSetting(ROOT_NAME_KEY, root.name);
  await putSetting(ROOT_KIND_KEY, storedKind(root));
}

function ensureDirectory(uri: string): Directory {
  const directory = new Directory(uri);
  if (!uri.startsWith('content://') && !directory.exists) {
    directory.create({ idempotent: true, intermediates: true });
  }
  return directory;
}

function openSource(uri: string): Directory | null {
  try {
    const directory = new Directory(uri);
    return directory.exists ? directory : null;
  } catch {
    return null;
  }
}

function openTarget(uri: string): Directory | null {
  try {
    return ensureDirectory(uri);
  } catch {
    return null;
  }
}

function collectFiles(directory: Directory, found: File[] = []): File[] {
  let entries: (Directory | File)[];
  try {
    entries = directory.list();
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry instanceof File) found.push(entry);
    else collectFiles(entry, found);
  }
  return found;
}

function deleteEmptyDirectories(directory: Directory): void {
  let entries: (Directory | File)[];
  try {
    entries = directory.list();
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry instanceof Directory) deleteEmptyDirectories(entry);
  }
  try {
    if (directory.exists && directory.list().length === 0) directory.delete();
  } catch {}
}

export async function getStorageRoot(): Promise<StorageRoot> {
  const [uri, name, kind] = await Promise.all([
    getSetting(ROOT_URI_KEY),
    getSetting(ROOT_NAME_KEY),
    getSetting(ROOT_KIND_KEY),
  ]);

  if (uri) {
    return {
      uri,
      name: name ?? (kind === 'legacy' ? LEGACY_ROOT_NAME : DEFAULT_ROOT_NAME),
      kind: kind === 'picked' ? 'picked' : 'app',
    };
  }

  const folder = kind === 'legacy' ? LEGACY_ROOT_NAME : DEFAULT_ROOT_NAME;
  const directory = new Directory(Paths.document, folder);
  if (!directory.exists) directory.create({ idempotent: true, intermediates: true });
  const root: StorageRoot = {
    uri: directory.uri,
    name: directory.name,
    kind: 'app',
  };
  await persistRoot(root);
  return root;
}

export async function chooseStorageRoot(): Promise<StorageRoot | null> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch {
    return null;
  }
  if (!directory?.uri) return null;

  const root: StorageRoot = {
    uri: directory.uri,
    name: directory.name,
    kind: 'picked',
  };
  await persistRoot(root);
  return root;
}

export async function setStorageRoot(root: StorageRoot): Promise<void> {
  await persistRoot(root);
}

export async function listOwnedFiles(root: StorageRoot): Promise<File[]> {
  let directory: Directory;
  try {
    directory = new Directory(root.uri);
    if (!directory.exists) return [];
    return directory.list().filter((entry): entry is File => entry instanceof File);
  } catch {
    return [];
  }
}

export async function moveOwnedFiles(to: StorageRoot): Promise<MoveResult> {
  const from = await getStorageRoot();
  const flatten = from.uri === to.uri;

  const failures: { name: string; reason: string }[] = [];
  let moved = 0;

  const source = openSource(from.uri);
  if (!source) return { moved: 0, failures: [] };

  const target = openTarget(to.uri);
  if (!target) {
    return {
      moved: 0,
      failures: [{ name: to.name, reason: 'The destination folder is not accessible.' }],
    };
  }

  let taken: Set<string>;
  try {
    taken = new Set(target.list().map((entry) => entry.name));
  } catch {
    taken = new Set();
  }

  const moveFile = async (file: File): Promise<void> => {
    const oldUri = file.uri;
    const name = uniqueFileName(file.name, taken);
    const destination = new File(target, name);
    try {
      await file.move(destination);
      taken.add(name);
      const record = await findTrackByLocation(oldUri);
      if (record) {
        await updateTrackFields(record.id, { location: destination.uri, fileName: name });
      }
      moved += 1;
    } catch (error) {
      failures.push({ name: file.name, reason: errorMessage(error) });
    }
  };

  let entries: (Directory | File)[];
  try {
    entries = source.list();
  } catch (error) {
    return { moved: 0, failures: [{ name: from.name, reason: errorMessage(error) }] };
  }

  if (flatten) {
    const directories = entries.filter(
      (entry): entry is Directory => entry instanceof Directory,
    );
    for (const directory of directories) {
      for (const file of collectFiles(directory)) await moveFile(file);
    }
    for (const directory of directories) deleteEmptyDirectories(directory);
    return { moved, failures };
  }

  const directories: Directory[] = [];
  for (const entry of entries) {
    if (entry instanceof File) await moveFile(entry);
    else directories.push(entry);
  }

  for (const directory of directories) {
    let nested: (Directory | File)[];
    try {
      nested = directory.list();
    } catch {
      continue;
    }
    for (const entry of nested) {
      if (entry instanceof File) await moveFile(entry);
    }
    try {
      if (directory.exists && directory.list().length === 0) directory.delete();
    } catch {}
  }

  return { moved, failures };
}

export async function storageInfo(): Promise<{
  root: StorageRoot;
  fileCount: number;
  totalBytes: number;
  reclaimableBytes: number;
}> {
  const root = await getStorageRoot();
  const files = collectFiles(new Directory(root.uri));
  let totalBytes = 0;
  for (const file of files) {
    try {
      const size = file.size;
      if (Number.isFinite(size) && size > 0) totalBytes += size;
    } catch {}
  }

  let reclaimableBytes = 0;
  for (const track of await listRemovedOwnedTracks()) {
    try {
      const file = new File(track.location);
      if (!file.exists) continue;
      const size = file.size;
      if (Number.isFinite(size) && size > 0) reclaimableBytes += size;
    } catch {}
  }

  return { root, fileCount: files.length, totalBytes, reclaimableBytes };
}

export async function cleanRemovedOwnedFiles(): Promise<{
  deleted: number;
  bytes: number;
  failures: { name: string; reason: string }[];
}> {
  let deleted = 0;
  let bytes = 0;
  const failures: { name: string; reason: string }[] = [];

  for (const track of await listRemovedOwnedTracks()) {
    try {
      const file = new File(track.location);
      if (file.exists) {
        const size = file.size;
        file.delete();
        deleted += 1;
        if (Number.isFinite(size) && size > 0) bytes += size;
      }
    } catch (error) {
      failures.push({ name: track.fileName, reason: errorMessage(error) });
      continue;
    }

    try {
      await deleteTrackRecord(track.id);
    } catch (error) {
      failures.push({ name: track.fileName, reason: errorMessage(error) });
    }
  }

  return { deleted, bytes, failures };
}

export async function deleteOwnedFile(location: string): Promise<void> {
  if (!location) return;
  try {
    const file = new File(location);
    if (file.exists) file.delete();
  } catch {}
}
