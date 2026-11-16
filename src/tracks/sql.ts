import type { TrackFieldPatch, TrackRecord } from './types.ts';

export const TRACK_COLUMNS = `
  id, source, location, fileName, sizeBytes, durationMs, title, artist, album,
  albumArtist, trackNumber, discNumber, year, genre, explicit, artworkUri,
  status, missing, addedAt, lastSeenAt, artworkHue
`;

export const SCAN_UPSERT_SQL = `
INSERT INTO tracks (id, source, location, fileName, sizeBytes, durationMs, title, artist, album, albumArtist, trackNumber, discNumber, year, genre, explicit, artworkUri, status, missing, addedAt, lastSeenAt, artworkHue)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  location = excluded.location,
  fileName = excluded.fileName,
  sizeBytes = COALESCE(excluded.sizeBytes, tracks.sizeBytes),
  durationMs = CASE WHEN tracks.durationMs = 0 THEN excluded.durationMs ELSE tracks.durationMs END,
  title = CASE WHEN tracks.title = '' THEN excluded.title ELSE tracks.title END,
  lastSeenAt = excluded.lastSeenAt,
  missing = 0
WHERE tracks.status <> 'removed'
`;

export const SCAN_MISSING_SQL = `
UPDATE tracks SET missing = 1
WHERE source = 'scan' AND status = 'active' AND lastSeenAt < ?
`;

export const INSERT_OWNED_SQL = `
INSERT INTO tracks (id, source, location, fileName, sizeBytes, durationMs, title, artist, album, albumArtist, trackNumber, discNumber, year, genre, explicit, artworkUri, status, missing, addedAt, lastSeenAt, artworkHue)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export const COUNT_BY_STATUS_SQL =
  'SELECT COUNT(*) AS count FROM tracks WHERE status = ?';
export const COUNT_ACTIVE_SCAN_SQL =
  "SELECT COUNT(*) AS count FROM tracks WHERE source = 'scan' AND status = 'active'";
export const COUNT_ACTIVE_OWNED_SQL =
  "SELECT COUNT(*) AS count FROM tracks WHERE source IN ('import', 'download') AND status = 'active'";

export const TRACK_DEPENDENT_DELETE_SQL: string[] = [
  'DELETE FROM favorites WHERE trackId = ?',
  'DELETE FROM play_history WHERE trackId = ?',
  'DELETE FROM lyrics_cache WHERE trackId = ?',
  'DELETE FROM playlist_tracks WHERE trackId = ?',
];

export const DELETE_TRACK_SQL = 'DELETE FROM tracks WHERE id = ?';

const UPDATE_FIELDS = [
  'location',
  'fileName',
  'sizeBytes',
  'durationMs',
  'title',
  'artist',
  'album',
  'albumArtist',
  'trackNumber',
  'discNumber',
  'year',
  'genre',
  'explicit',
  'artworkUri',
] as const;

function trackParam(value: string | number | boolean | null | undefined): string | number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function fieldParams(row: TrackRecord): (string | number | null)[] {
  return [
    row.id,
    row.source,
    row.location,
    row.fileName,
    trackParam(row.sizeBytes),
    row.durationMs,
    row.title,
    row.artist,
    row.album,
    trackParam(row.albumArtist),
    trackParam(row.trackNumber),
    trackParam(row.discNumber),
    trackParam(row.year),
    trackParam(row.genre),
    trackParam(row.explicit),
    trackParam(row.artworkUri),
  ];
}

export function scanUpsertParams(row: TrackRecord): (string | number | null)[] {
  return [...fieldParams(row), row.addedAt, row.lastSeenAt, row.artworkHue];
}

export function ownedInsertParams(row: TrackRecord): (string | number | null)[] {
  return [
    ...fieldParams(row),
    row.status,
    row.missing,
    row.addedAt,
    row.lastSeenAt,
    row.artworkHue,
  ];
}

export function buildTrackUpdate(
  id: string,
  patch: TrackFieldPatch,
): { sql: string; params: (string | number | null)[] } {
  const assignments: string[] = [];
  const params: (string | number | null)[] = [];

  for (const field of UPDATE_FIELDS) {
    const value = patch[field];
    if (value === undefined) continue;
    assignments.push(`${field} = ?`);
    params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
  }

  if (assignments.length === 0) return { sql: '', params: [] };

  return {
    sql: `UPDATE tracks SET ${assignments.join(', ')} WHERE id = ?`,
    params: [...params, id],
  };
}
