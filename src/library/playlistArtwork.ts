import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { extensionForMime } from '../lib/importName';
import { MAX_ARTWORK_BYTES } from '../lib/artworkInput';

const DIRECTORY_NAME = 'playlist-artwork';
const STAGING_DIRECTORY_NAME = 'playlist-cover-staging';

function mediaType(mime: string | undefined): string {
  return mime?.split(';')[0]?.trim().toLowerCase() ?? '';
}

function extensionOfName(name: string): string | null {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  return match ? match[1].toLowerCase() : null;
}

function coverDirectory(): Directory {
  const directory = new Directory(Paths.document, DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function stagingDirectory(): Directory {
  const directory = new Directory(Paths.cache, STAGING_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function deleteCoverFiles(directory: Directory, playlistId: string, keepName?: string): void {
  for (const entry of directory.list()) {
    if (!(entry instanceof File) || entry.name === keepName) continue;
    if (!entry.name.startsWith(`${playlistId}.`)) continue;
    try {
      entry.delete();
    } catch {}
  }
}

export async function stagePlaylistCover(playlistId: string): Promise<string | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'image/*',
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset) return null;

  const mime = mediaType(asset.mimeType);
  if (!mime.startsWith('image/')) return null;
  if (typeof asset.size === 'number' && asset.size > MAX_ARTWORK_BYTES) return null;

  const source = new File(asset.uri);
  if (!Number.isFinite(source.size) || source.size <= 0 || source.size > MAX_ARTWORK_BYTES) {
    return null;
  }

  const extension = extensionForMime(mime) ?? extensionOfName(asset.name) ?? 'jpg';
  const directory = stagingDirectory();
  const destination = new File(directory, `stage-${playlistId}-${Date.now()}.${extension}`);
  await source.copy(destination, { overwrite: true });
  return destination.uri;
}

export async function commitPlaylistCover(
  playlistId: string,
  stagedUri: string,
): Promise<string> {
  const source = new File(stagedUri);
  if (!source.exists) throw new Error('The staged cover is missing.');
  if (!Number.isFinite(source.size) || source.size <= 0 || source.size > MAX_ARTWORK_BYTES) {
    throw new Error('The staged cover is invalid.');
  }

  const extension = extensionOfName(stagedUri) ?? 'jpg';
  const directory = coverDirectory();
  const destination = new File(directory, `${playlistId}.${extension}`);
  await source.copy(destination, { overwrite: true });
  deleteCoverFiles(directory, playlistId, destination.name);
  return destination.uri;
}

export async function discardStagedCover(stagedUri: string): Promise<void> {
  try {
    const file = new File(stagedUri);
    if (file.exists) file.delete();
  } catch {}
}

export async function deletePlaylistCoverFile(playlistId: string): Promise<void> {
  try {
    const directory = new Directory(Paths.document, DIRECTORY_NAME);
    if (directory.exists) deleteCoverFiles(directory, playlistId);
  } catch {}
}
