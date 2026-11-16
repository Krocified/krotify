import type { Track } from '../types.ts';
import type { TrackRecord } from './types.ts';

export function toUiTrack(record: TrackRecord): Track {
  return {
    id: record.id,
    uri: record.location,
    source: record.source === 'scan' ? 'scan' : 'import',
    title: record.title,
    artist: record.artist,
    album: record.album,
    durationMs: record.durationMs,
    artworkHue: record.artworkHue,
    artworkUri: record.artworkUri,
    trackNumber: record.trackNumber,
    discNumber: record.discNumber,
    year: record.year,
    genre: record.genre,
    albumArtist: record.albumArtist,
    explicit: record.explicit,
    missing: record.missing,
  };
}
