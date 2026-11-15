import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { updatePlaylistDetails, type Playlist } from '../db/repo';
import { extensionForMime } from '../lib/importName';
import { MAX_ARTWORK_BYTES } from '../lib/tagPatch';

const DIRECTORY_NAME = 'playlist-artwork';

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

function deleteCoverFiles(directory: Directory, playlistId: string, keepName?: string): void {
  for (const entry of directory.list()) {
    if (!(entry instanceof File) || entry.name === keepName) continue;
    if (!entry.name.startsWith(`${playlistId}.`)) continue;
    try {
      entry.delete();
    } catch {}
  }
}

export async function pickPlaylistCover(playlistId: string): Promise<string | null> {
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

  const extension = extensionForMime(mime) ?? extensionOfName(asset.name) ?? 'jpg';
  const directory = coverDirectory();
  const destination = new File(directory, `${playlistId}.${extension}`);
  await new File(asset.uri).copy(destination, { overwrite: true });
  deleteCoverFiles(directory, playlistId, destination.name);

  await updatePlaylistDetails(playlistId, { artworkUri: destination.uri });
  return destination.uri;
}

export async function removePlaylistCover(playlist: Playlist): Promise<void> {
  const directory = new Directory(Paths.document, DIRECTORY_NAME);
  if (directory.exists) deleteCoverFiles(directory, playlist.id);
  await updatePlaylistDetails(playlist.id, { artworkUri: null });
}
