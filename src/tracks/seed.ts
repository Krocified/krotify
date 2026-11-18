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

function seedFromTags(tags: Partial<Record<(typeof FIELDS)[number], unknown>>): TrackSeed {
  return {
    title: (tags.title as string | null | undefined) ?? undefined,
    artist: (tags.artist as string | null | undefined) ?? undefined,
    album: (tags.albumTitle as string | null | undefined) ?? undefined,
    albumArtist: (tags.albumArtist as string | null | undefined) ?? undefined,
    trackNumber: (tags.trackNumber as number | null | undefined) ?? undefined,
    discNumber: (tags.discNumber as number | null | undefined) ?? undefined,
    year: (tags.year as number | null | undefined) ?? undefined,
    genre: (tags.genre as string | null | undefined) ?? undefined,
  };
}

export async function readTrackSeeds(
  locations: readonly string[],
): Promise<Map<string, TrackSeed>> {
  const seeds = new Map<string, TrackSeed>();
  if (locations.length === 0) return seeds;
  try {
    const { results } = await getBulkMetadata([...locations], FIELDS);
    for (const result of results) {
      seeds.set(result.uri, seedFromTags(result.data ?? {}));
    }
  } catch {}
  return seeds;
}

export async function saveSeedArtwork(location: string): Promise<string | undefined> {
  try {
    const directory = new Directory(Paths.document, 'artwork');
    directory.create({ intermediates: true, idempotent: true });
    const saved = await saveHashedArtwork(location, {
      saveDirectory: directory.uri,
      knownHashes: [],
    });
    return saved?.uri;
  } catch {
    return undefined;
  }
}

export async function readTrackSeed(location: string): Promise<TrackSeed> {
  const seeds = await readTrackSeeds([location]);
  const seed = seeds.get(location) ?? {};
  const artworkUri = await saveSeedArtwork(location);
  if (artworkUri) seed.artworkUri = artworkUri;
  return seed;
}
