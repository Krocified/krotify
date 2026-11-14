import { getBulkMetadata, saveHashedArtwork } from '@missingcore/react-native-metadata-retriever';
import { Directory, Paths } from 'expo-file-system';
import type { Track } from '../types';
import {
  getCachedMetadata,
  putCachedMetadata,
  type CachedMetadata,
} from '../db/repo';

export type TrackMetadata = {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: number;
  trackNumber?: number;
  discNumber?: number;
  genre?: string;
  artworkUri?: string;
  explicit?: boolean;
};

const CHUNK_SIZE = 50;
const FIELDS = ['title', 'artist', 'albumTitle', 'albumArtist', 'year', 'trackNumber', 'genre'] as const;

type TagData = {
  title: string | null;
  artist: string | null;
  albumTitle: string | null;
  albumArtist: string | null;
  year: number | null;
  trackNumber: number | null;
  genre: string | null;
};

const TAG_KEYS = [
  'title',
  'artist',
  'album',
  'albumArtist',
  'year',
  'trackNumber',
  'discNumber',
  'genre',
  'explicit',
] as const;

function hasCachedTags(cache: CachedMetadata | null): boolean {
  return cache !== null && TAG_KEYS.some((key) => cache[key] !== undefined);
}

function merge(track: Track, cache: CachedMetadata | null, tags?: TagData): Track {
  return {
    ...track,
    title: tags?.title ?? cache?.title ?? track.title,
    artist: tags?.artist ?? cache?.artist ?? track.artist,
    album: tags?.albumTitle ?? cache?.album ?? track.album,
    albumArtist: tags?.albumArtist ?? cache?.albumArtist ?? track.albumArtist,
    year: tags?.year ?? cache?.year ?? track.year,
    trackNumber: tags?.trackNumber ?? cache?.trackNumber ?? track.trackNumber,
    discNumber: cache?.discNumber ?? track.discNumber,
    genre: tags?.genre ?? cache?.genre ?? track.genre,
    artworkUri: track.artworkUri ?? cache?.artworkUri,
    explicit: cache?.explicit ?? track.explicit,
  };
}

function toCached(track: Track): CachedMetadata {
  return {
    title: track.title,
    artist: track.artist,
    album: track.album,
    albumArtist: track.albumArtist,
    year: track.year,
    trackNumber: track.trackNumber,
    discNumber: track.discNumber,
    genre: track.genre,
    artworkUri: track.artworkUri,
    explicit: track.explicit,
  };
}

async function enrichChunk(
  tracks: Track[],
  getUri: (track: Track) => Promise<string | null>,
): Promise<Track[]> {
  const [caches, uris] = await Promise.all([
    Promise.all(tracks.map((track) => getCachedMetadata(track.id))),
    Promise.all(
      tracks.map(async (track) => {
        if (track.uri) return track.uri;
        try {
          return await getUri(track);
        } catch {
          return null;
        }
      }),
    ),
  ]);

  const merged = tracks.map((track, index) => {
    const cache = caches[index];
    const uri = track.uri || uris[index] || '';
    const withUri = uri === track.uri ? track : { ...track, uri };
    return hasCachedTags(cache) ? merge(withUri, cache) : withUri;
  });

  const pending: { index: number; track: Track }[] = [];
  merged.forEach((track, index) => {
    if (!hasCachedTags(caches[index]) && track.uri) pending.push({ index, track });
  });

  if (pending.length > 0) {
    let tagsByUri = new Map<string, TagData>();
    let fetched = false;
    try {
      const { results } = await getBulkMetadata(
        pending.map((item) => item.track.uri),
        FIELDS,
      );
      tagsByUri = new Map(results.map((result) => [result.uri, result.data]));
      fetched = true;
    } catch {
    }

    for (const { index, track } of pending) {
      const next = merge(track, caches[index], tagsByUri.get(track.uri));
      merged[index] = next;
      if (fetched) await putCachedMetadata(next.id, toCached(next));
    }
  }

  return merged;
}

export async function enrichTracks(
  tracks: Track[],
  getUri: (track: Track) => Promise<string | null>,
  onBatch: (updated: Track[]) => void,
): Promise<Track[]> {
  const result: Track[] = [];
  for (let start = 0; start < tracks.length; start += CHUNK_SIZE) {
    const chunk = await enrichChunk(tracks.slice(start, start + CHUNK_SIZE), getUri);
    result.push(...chunk);
    onBatch(chunk);
  }
  return result;
}

export async function loadArtwork(track: Track): Promise<string | null> {
  const cache = await getCachedMetadata(track.id);
  if (cache?.artworkUri) return cache.artworkUri;
  if (!track.uri) return null;

  const directory = new Directory(Paths.document, 'artwork');
  directory.create({ intermediates: true, idempotent: true });
  try {
    const saved = await saveHashedArtwork(track.uri, {
      saveDirectory: directory.uri,
      knownHashes: [],
    });
    if (!saved) return null;
    await putCachedMetadata(track.id, { ...cache, artworkUri: saved.uri });
    return saved.uri;
  } catch {
    return null;
  }
}
