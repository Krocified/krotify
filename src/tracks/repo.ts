import { getDb } from '../db/index';
import { ownedTrackId } from './ids.ts';
import { ownedRow, scanRow } from './rows.ts';
import {
  COUNT_ACTIVE_OWNED_SQL,
  COUNT_ACTIVE_SCAN_SQL,
  COUNT_BY_STATUS_SQL,
  DELETE_TRACK_SQL,
  INSERT_OWNED_SQL,
  SCAN_MISSING_SQL,
  SCAN_UPSERT_SQL,
  TRACK_COLUMNS,
  TRACK_DEPENDENT_DELETE_SQL,
  buildTrackUpdate,
  scanUpsertParams,
} from './sql.ts';
import type {
  NewOwnedTrack,
  ScanTrackInput,
  TrackFieldPatch,
  TrackRecord,
  TrackSource,
  TrackStatus,
} from './types.ts';

type TrackRow = {
  id: string;
  source: TrackSource;
  location: string;
  fileName: string;
  sizeBytes: number | null;
  durationMs: number;
  title: string;
  artist: string;
  album: string;
  albumArtist: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  year: number | null;
  genre: string | null;
  explicit: number | null;
  artworkUri: string | null;
  status: TrackStatus;
  missing: number;
  addedAt: number;
  lastSeenAt: number;
  artworkHue: number;
};

function toRecord(row: TrackRow): TrackRecord {
  return {
    id: row.id,
    source: row.source,
    location: row.location,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes ?? undefined,
    durationMs: row.durationMs,
    title: row.title,
    artist: row.artist,
    album: row.album,
    albumArtist: row.albumArtist ?? undefined,
    trackNumber: row.trackNumber ?? undefined,
    discNumber: row.discNumber ?? undefined,
    year: row.year ?? undefined,
    genre: row.genre ?? undefined,
    explicit: row.explicit === null ? undefined : row.explicit !== 0,
    artworkUri: row.artworkUri ?? undefined,
    status: row.status,
    missing: row.missing === 1 ? 1 : 0,
    addedAt: row.addedAt,
    lastSeenAt: row.lastSeenAt,
    artworkHue: row.artworkHue,
  };
}

function ownedInsertParams(row: TrackRecord): (string | number | null)[] {
  return [
    row.id,
    row.source,
    row.location,
    row.fileName,
    row.sizeBytes ?? null,
    row.durationMs,
    row.title,
    row.artist,
    row.album,
    row.albumArtist ?? null,
    row.trackNumber ?? null,
    row.discNumber ?? null,
    row.year ?? null,
    row.genre ?? null,
    row.explicit === undefined ? null : row.explicit ? 1 : 0,
    row.artworkUri ?? null,
    row.status,
    row.missing,
    row.addedAt,
    row.lastSeenAt,
    row.artworkHue,
  ];
}

async function listTracks(where: string): Promise<TrackRecord[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.getAllAsync<TrackRow>(
    `SELECT ${TRACK_COLUMNS} FROM tracks WHERE ${where} ORDER BY title, id`,
  );
  return rows.map(toRecord);
}

async function countRows(sql: string, ...params: (string | number)[]): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const row = await db.getFirstAsync<{ count: number }>(sql, ...params);
  return Number(row?.count ?? 0);
}

export function listActiveTracks(): Promise<TrackRecord[]> {
  return listTracks("status = 'active' AND location <> ''");
}

export function listHiddenTracks(): Promise<TrackRecord[]> {
  return listTracks("status = 'hidden'");
}

export function listRemovedOwnedTracks(): Promise<TrackRecord[]> {
  return listTracks("status = 'removed' AND source IN ('import', 'download')");
}

export async function getTrack(id: string): Promise<TrackRecord | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await db.getFirstAsync<TrackRow>(
    `SELECT ${TRACK_COLUMNS} FROM tracks WHERE id = ?`,
    id,
  );
  return row ? toRecord(row) : null;
}

export async function upsertScanTracks(
  tracks: ScanTrackInput[],
  now = Date.now(),
): Promise<{ insertedIds: string[]; updated: number; missing: number }> {
  const db = await getDb();
  if (!db) return { insertedIds: [], updated: 0, missing: 0 };

  const insertedIds: string[] = [];
  let updated = 0;
  const chunkSize = 100;

  for (let start = 0; start < tracks.length; start += chunkSize) {
    const chunk = tracks.slice(start, start + chunkSize);
    await db.withTransactionAsync(async () => {
      const ids = chunk.map((track) => track.id);
      const placeholders = ids.map(() => '?').join(', ');
      const existing = await db.getAllAsync<{ id: string; status: TrackStatus }>(
        `SELECT id, status FROM tracks WHERE id IN (${placeholders})`,
        ...ids,
      );
      const existingById = new Map(existing.map((row) => [row.id, row.status]));

      for (const track of chunk) {
        const status = existingById.get(track.id);
        const row = scanRow(track, now);
        const result = await db.runAsync(SCAN_UPSERT_SQL, ...scanUpsertParams(row));
        if (status === undefined) {
          if (result.changes > 0) insertedIds.push(track.id);
          existingById.set(track.id, 'active');
        } else if (status !== 'removed' && result.changes > 0) {
          updated += 1;
        }
      }
    });
  }

  const result = await db.runAsync(SCAN_MISSING_SQL, now);
  return { insertedIds, updated, missing: result.changes };
}

export async function insertOwnedTrack(input: NewOwnedTrack): Promise<TrackRecord> {
  const row = ownedRow(input, ownedTrackId(), Date.now());
  const db = await getDb();
  if (!db) return row;
  await db.runAsync(INSERT_OWNED_SQL, ...ownedInsertParams(row));
  return row;
}

export async function updateTrackFields(
  id: string,
  patch: TrackFieldPatch,
): Promise<void> {
  const update = buildTrackUpdate(id, patch);
  if (!update.sql) return;
  const db = await getDb();
  if (!db) return;
  await db.runAsync(update.sql, ...update.params);
}

export async function setTrackStatus(id: string, status: TrackStatus): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync('UPDATE tracks SET status = ? WHERE id = ?', status, id);
}

export async function setTrackMissing(id: string, missing: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync('UPDATE tracks SET missing = ? WHERE id = ?', missing ? 1 : 0, id);
}

export async function deleteTrackRecord(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.withTransactionAsync(async () => {
    for (const sql of TRACK_DEPENDENT_DELETE_SQL) {
      await db.runAsync(sql, id);
    }
    await db.runAsync(DELETE_TRACK_SQL, id);
  });
}

export async function findTrackByLocation(location: string): Promise<TrackRecord | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await db.getFirstAsync<TrackRow>(
    `SELECT ${TRACK_COLUMNS} FROM tracks WHERE location = ? ORDER BY addedAt DESC LIMIT 1`,
    location,
  );
  return row ? toRecord(row) : null;
}

export async function findOwnedByKey(
  fileName: string,
  sizeBytes: number,
): Promise<TrackRecord | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await db.getFirstAsync<TrackRow>(
    `SELECT ${TRACK_COLUMNS} FROM tracks
      WHERE source IN ('import', 'download') AND fileName = ? AND sizeBytes = ?
      ORDER BY addedAt DESC LIMIT 1`,
    fileName,
    sizeBytes,
  );
  return row ? toRecord(row) : null;
}

export function countTracks(status: TrackStatus): Promise<number> {
  return countRows(COUNT_BY_STATUS_SQL, status);
}

export function countActiveScanTracks(): Promise<number> {
  return countRows(COUNT_ACTIVE_SCAN_SQL);
}

export function countActiveOwnedTracks(): Promise<number> {
  return countRows(COUNT_ACTIVE_OWNED_SQL);
}
