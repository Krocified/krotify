import { getBulkMetadata, saveHashedArtwork } from '@missingcore/react-native-metadata-retriever';
import { Directory, Paths } from 'expo-file-system';
import type { TrackSeed } from './seedMap';

const FIELDS = [
  'title',
  'artist',
  'albumTitle',
  'albumArtist',
  'year',
  'trackNumber',
  'discNumber',
  'genre',
] as const;

export async function readTrackSeed(location: string): Promise<TrackSeed> {
  const seed: TrackSeed = {};

  try {
    const { results } = await getBulkMetadata([location], FIELDS);
    const tags = results[0]?.data;
    if (tags) {
      seed.title = tags.title ?? undefined;
      seed.artist = tags.artist ?? undefined;
      seed.album = tags.albumTitle ?? undefined;
      seed.albumArtist = tags.albumArtist ?? undefined;
      seed.trackNumber = tags.trackNumber ?? undefined;
      seed.discNumber = tags.discNumber ?? undefined;
      seed.year = tags.year ?? undefined;
      seed.genre = tags.genre ?? undefined;
    }
  } catch {
  }

  try {
    const directory = new Directory(Paths.document, 'artwork');
    directory.create({ intermediates: true, idempotent: true });
    const saved = await saveHashedArtwork(location, {
      saveDirectory: directory.uri,
      knownHashes: [],
    });
    if (saved) seed.artworkUri = saved.uri;
  } catch {
  }

  return seed;
}
