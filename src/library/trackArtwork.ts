import { Directory, File, Paths } from 'expo-file-system';

function extensionOf(uri: string): string {
  const clean = uri.split('?')[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1) : '';
}

export async function persistTrackArtwork(file: File): Promise<string> {
  const directory = new Directory(Paths.document, 'artwork');
  directory.create({ intermediates: true, idempotent: true });
  const extension = extensionOf(file.name) || 'jpg';
  const destination = new File(directory, `edit-${Date.now()}.${extension.toLowerCase()}`);
  await file.copy(destination);
  return destination.uri;
}
