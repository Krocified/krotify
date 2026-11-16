import type { SQLiteDatabase } from 'expo-sqlite';
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
  ownedInsertParams,
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

type TrackParam = string | number | null;

export type TrackDb = {
  getAllAsync<T>(sql: string, ...params: TrackParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: TrackParam[]): Promise<T | null>;
  runAsync(sql: string, ...params: TrackParam[]): Promise<{ changes: number }>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

export type TrackRepo = {
  listActiveTracks(): Promise<TrackRecord[]>;
  listHiddenTracks(): Promise<TrackRecord[]>;
  listRemovedOwnedTracks(): Promise<TrackRecord[]>;
  getTrack(id: string): Promise<TrackRecord | null>;
  upsertScanTracks(
    tracks: ScanTrackInput[],
    now?: number,
  ): Promise<{ insertedIds: string[]; updated: number; missing: number }>;
  insertOwnedTrack(input: NewOwnedTrack): Promise<TrackRecord>;
  updateTrackFields(id: string, patch: TrackFieldPatch): Promise<void>;
  setTrackStatus(id: string, status: TrackStatus): Promise<void>;
  setTrackMissing(id: string, missing: boolean): Promise<void>;
  deleteTrackRecord(id: string): Promise<void>;
  findTrackByLocation(location: string): Promise<TrackRecord | null>;
  findOwnedByKey(fileName: string, sizeBytes: number): Promise<TrackRecord | null>;
  countTracks(status: TrackStatus): Promise<number>;
  countActiveScanTracks(): Promise<number>;
  countActiveOwnedTracks(): Promise<number>;
};

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

export function createTrackRepo(db: TrackDb): TrackRepo {
  async function listTracks(where: string): Promise<TrackRecord[]> {
    const rows = await db.getAllAsync<TrackRow>(
      `SELECT ${TRACK_COLUMNS} FROM tracks WHERE ${where} ORDER BY title, id`,
    );
    return rows.map(toRecord);
  }

  async function countRows(sql: string, ...params: TrackParam[]): Promise<number> {
    const row = await db.getFirstAsync<{ count: number }>(sql, ...params);
    return Number(row?.count ?? 0);
  }

  return {
    listActiveTracks() {
      return listTracks("status = 'active' AND location <> ''");
    },

    listHiddenTracks() {
      return listTracks("status = 'hidden'");
    },

    listRemovedOwnedTracks() {
      return listTracks("status = 'removed' AND source IN ('import', 'download')");
    },

    async getTrack(id) {
      const row = await db.getFirstAsync<TrackRow>(
        `SELECT ${TRACK_COLUMNS} FROM tracks WHERE id = ?`,
        id,
      );
      return row ? toRecord(row) : null;
    },

    async upsertScanTracks(tracks, now = Date.now()) {
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
    },

    async insertOwnedTrack(input) {
      const row = ownedRow(input, ownedTrackId(), Date.now());
      await db.runAsync(INSERT_OWNED_SQL, ...ownedInsertParams(row));
      return row;
    },

    async updateTrackFields(id, patch) {
      const update = buildTrackUpdate(id, patch);
      if (!update.sql) return;
      await db.runAsync(update.sql, ...update.params);
    },

    async setTrackStatus(id, status) {
      await db.runAsync('UPDATE tracks SET status = ? WHERE id = ?', status, id);
    },

    async setTrackMissing(id, missing) {
      await db.runAsync('UPDATE tracks SET missing = ? WHERE id = ?', missing ? 1 : 0, id);
    },

    async deleteTrackRecord(id) {
      await db.withTransactionAsync(async () => {
        for (const sql of TRACK_DEPENDENT_DELETE_SQL) {
          await db.runAsync(sql, id);
        }
        await db.runAsync(DELETE_TRACK_SQL, id);
      });
    },

    async findTrackByLocation(location) {
      const row = await db.getFirstAsync<TrackRow>(
        `SELECT ${TRACK_COLUMNS} FROM tracks WHERE location = ? ORDER BY addedAt DESC LIMIT 1`,
        location,
      );
      return row ? toRecord(row) : null;
    },

    async findOwnedByKey(fileName, sizeBytes) {
      const row = await db.getFirstAsync<TrackRow>(
        `SELECT ${TRACK_COLUMNS} FROM tracks
          WHERE source IN ('import', 'download') AND fileName = ? AND sizeBytes = ?
          ORDER BY addedAt DESC LIMIT 1`,
        fileName,
        sizeBytes,
      );
      return row ? toRecord(row) : null;
    },

    countTracks(status) {
      return countRows(COUNT_BY_STATUS_SQL, status);
    },

    countActiveScanTracks() {
      return countRows(COUNT_ACTIVE_SCAN_SQL);
    },

    countActiveOwnedTracks() {
      return countRows(COUNT_ACTIVE_OWNED_SQL);
    },
  };
}

function fromExpo(db: SQLiteDatabase): TrackDb {
  return {
    getAllAsync: <T>(sql: string, ...params: TrackParam[]) =>
      db.getAllAsync<T>(sql, ...params),
    getFirstAsync: <T>(sql: string, ...params: TrackParam[]) =>
      db.getFirstAsync<T>(sql, ...params),
    runAsync: async (sql, ...params) => {
      const result = await db.runAsync(sql, ...params);
      return { changes: Number(result.changes) };
    },
    withTransactionAsync: (task) => db.withTransactionAsync(task),
  };
}

async function defaultRepo(): Promise<TrackRepo | null> {
  const { getDb } = await import('../db/index');
  const db = await getDb();
  if (!db) return null;
  return createTrackRepo(fromExpo(db));
}

export async function listActiveTracks(): Promise<TrackRecord[]> {
  const repo = await defaultRepo();
  return repo ? repo.listActiveTracks() : [];
}

export async function listHiddenTracks(): Promise<TrackRecord[]> {
  const repo = await defaultRepo();
  return repo ? repo.listHiddenTracks() : [];
}

export async function listRemovedOwnedTracks(): Promise<TrackRecord[]> {
  const repo = await defaultRepo();
  return repo ? repo.listRemovedOwnedTracks() : [];
}

export async function getTrack(id: string): Promise<TrackRecord | null> {
  const repo = await defaultRepo();
  return repo ? repo.getTrack(id) : null;
}

export async function upsertScanTracks(
  tracks: ScanTrackInput[],
  now = Date.now(),
): Promise<{ insertedIds: string[]; updated: number; missing: number }> {
  const repo = await defaultRepo();
  return repo ? repo.upsertScanTracks(tracks, now) : { insertedIds: [], updated: 0, missing: 0 };
}

export async function insertOwnedTrack(input: NewOwnedTrack): Promise<TrackRecord> {
  const repo = await defaultRepo();
  if (!repo) return ownedRow(input, ownedTrackId(), Date.now());
  return repo.insertOwnedTrack(input);
}

export async function updateTrackFields(
  id: string,
  patch: TrackFieldPatch,
): Promise<void> {
  const repo = await defaultRepo();
  if (repo) await repo.updateTrackFields(id, patch);
}

export async function setTrackStatus(id: string, status: TrackStatus): Promise<void> {
  const repo = await defaultRepo();
  if (repo) await repo.setTrackStatus(id, status);
}

export async function setTrackMissing(id: string, missing: boolean): Promise<void> {
  const repo = await defaultRepo();
  if (repo) await repo.setTrackMissing(id, missing);
}

export async function deleteTrackRecord(id: string): Promise<void> {
  const repo = await defaultRepo();
  if (repo) await repo.deleteTrackRecord(id);
}

export async function findTrackByLocation(location: string): Promise<TrackRecord | null> {
  const repo = await defaultRepo();
  return repo ? repo.findTrackByLocation(location) : null;
}

export async function findOwnedByKey(
  fileName: string,
  sizeBytes: number,
): Promise<TrackRecord | null> {
  const repo = await defaultRepo();
  return repo ? repo.findOwnedByKey(fileName, sizeBytes) : null;
}

export async function countTracks(status: TrackStatus): Promise<number> {
  const repo = await defaultRepo();
  return repo ? repo.countTracks(status) : 0;
}

export async function countActiveScanTracks(): Promise<number> {
  const repo = await defaultRepo();
  return repo ? repo.countActiveScanTracks() : 0;
}

export async function countActiveOwnedTracks(): Promise<number> {
  const repo = await defaultRepo();
  return repo ? repo.countActiveOwnedTracks() : 0;
}
