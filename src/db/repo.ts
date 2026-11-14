import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb } from './index';

export type Playlist = { id: string; name: string; createdAt: number };

export type CachedMetadata = {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: number;
  trackNumber?: number;
  genre?: string;
  artworkUri?: string;
};

type MetadataRow = {
  id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  year: number | null;
  trackNumber: number | null;
  genre: string | null;
  artworkUri: string | null;
};

const orUndefined = <T>(value: T | null): T | undefined => (value === null ? undefined : value);

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function listPlaylists(): Promise<Playlist[]> {
  const db = await getDb();
  if (!db) return [];
  return db.getAllAsync<Playlist>('SELECT id, name, createdAt FROM playlists ORDER BY createdAt DESC');
}

export async function createPlaylist(name: string): Promise<Playlist> {
  const db = await getDb();
  const playlist: Playlist = { id: newId(), name, createdAt: Date.now() };
  if (!db) return playlist;
  await db.runAsync(
    'INSERT INTO playlists (id, name, createdAt) VALUES (?, ?, ?)',
    playlist.id,
    playlist.name,
    playlist.createdAt,
  );
  return playlist;
}

export async function deletePlaylist(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync('DELETE FROM playlists WHERE id = ?', id);
}

export async function renamePlaylist(id: string, name: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync('UPDATE playlists SET name = ? WHERE id = ?', name, id);
}

export async function listPlaylistTracks(playlistId: string): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.getAllAsync<{ trackId: string }>(
    'SELECT trackId FROM playlist_tracks WHERE playlistId = ? ORDER BY position ASC',
    playlistId,
  );
  return rows.map((row) => row.trackId);
}

export async function addPlaylistTrack(playlistId: string, trackId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync(
    `INSERT OR IGNORE INTO playlist_tracks (playlistId, trackId, position)
     VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1000 FROM playlist_tracks WHERE playlistId = ?))`,
    playlistId,
    trackId,
    playlistId,
  );
}

export async function removePlaylistTrack(playlistId: string, trackId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync('DELETE FROM playlist_tracks WHERE playlistId = ? AND trackId = ?', playlistId, trackId);
}

type PositionRow = { trackId: string; position: number };

type MoveOutcome = 'moved' | 'none' | 'renumber';

async function moveOnce(
  db: SQLiteDatabase,
  playlistId: string,
  trackId: string,
  direction: 'up' | 'down',
): Promise<MoveOutcome> {
  const rows = await db.getAllAsync<PositionRow>(
    'SELECT trackId, position FROM playlist_tracks WHERE playlistId = ? ORDER BY position ASC, trackId ASC',
    playlistId,
  );
  const index = rows.findIndex((row) => row.trackId === trackId);
  if (index < 0) return 'none';
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= rows.length) return 'none';

  const target = rows[targetIndex];
  const outer = direction === 'up' ? rows[targetIndex - 1] : rows[targetIndex + 1];
  const low =
    direction === 'up' ? (outer?.position ?? target.position - 2000) : target.position;
  const high =
    direction === 'up' ? target.position : (outer?.position ?? target.position + 2000);
  if (high - low <= 1) return 'renumber';

  const position = Math.floor((low + high) / 2);
  await db.runAsync(
    'UPDATE playlist_tracks SET position = ? WHERE playlistId = ? AND trackId = ?',
    position,
    playlistId,
    trackId,
  );
  return 'moved';
}

async function renumberPlaylist(db: SQLiteDatabase, playlistId: string): Promise<void> {
  const rows = await db.getAllAsync<{ trackId: string }>(
    'SELECT trackId FROM playlist_tracks WHERE playlistId = ? ORDER BY position ASC, trackId ASC',
    playlistId,
  );
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < rows.length; i += 1) {
      await db.runAsync(
        'UPDATE playlist_tracks SET position = ? WHERE playlistId = ? AND trackId = ?',
        (i + 1) * 1000,
        playlistId,
        rows[i].trackId,
      );
    }
  });
}

export async function movePlaylistTrack(
  playlistId: string,
  trackId: string,
  direction: 'up' | 'down',
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const outcome = await moveOnce(db, playlistId, trackId, direction);
  if (outcome !== 'renumber') return;
  await renumberPlaylist(db, playlistId);
  await moveOnce(db, playlistId, trackId, direction);
}

export async function listFavoriteIds(): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();
  const rows = await db.getAllAsync<{ trackId: string }>('SELECT trackId FROM favorites');
  return new Set(rows.map((row) => row.trackId));
}

export async function toggleFavorite(trackId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.getFirstAsync<{ trackId: string }>(
    'SELECT trackId FROM favorites WHERE trackId = ?',
    trackId,
  );
  if (existing) {
    await db.runAsync('DELETE FROM favorites WHERE trackId = ?', trackId);
    return false;
  }
  await db.runAsync('INSERT INTO favorites (trackId, addedAt) VALUES (?, ?)', trackId, Date.now());
  return true;
}

export async function recordPlay(trackId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync('INSERT INTO play_history (trackId, playedAt) VALUES (?, ?)', trackId, Date.now());
}

export async function listRecentTrackIds(limit = 20): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.getAllAsync<{ trackId: string }>(
    `SELECT trackId FROM (
       SELECT trackId, MAX(playedAt) AS latest FROM play_history GROUP BY trackId
     ) ORDER BY latest DESC LIMIT ?`,
    limit,
  );
  return rows.map((row) => row.trackId);
}

export async function getCachedMetadata(id: string): Promise<CachedMetadata | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await db.getFirstAsync<MetadataRow>('SELECT * FROM track_metadata WHERE id = ?', id);
  if (!row) return null;
  return {
    title: orUndefined(row.title),
    artist: orUndefined(row.artist),
    album: orUndefined(row.album),
    albumArtist: orUndefined(row.albumArtist),
    year: orUndefined(row.year),
    trackNumber: orUndefined(row.trackNumber),
    genre: orUndefined(row.genre),
    artworkUri: orUndefined(row.artworkUri),
  };
}

export async function putCachedMetadata(id: string, meta: CachedMetadata): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO track_metadata
       (id, title, artist, album, albumArtist, year, trackNumber, genre, artworkUri)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    meta.title ?? null,
    meta.artist ?? null,
    meta.album ?? null,
    meta.albumArtist ?? null,
    meta.year ?? null,
    meta.trackNumber ?? null,
    meta.genre ?? null,
    meta.artworkUri ?? null,
  );
}

export async function listCachedMetadataIds(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM track_metadata');
  return rows.map((row) => row.id);
}

export type LyricsKind = 'synced' | 'plain' | 'instrumental' | 'none';

export type CachedLyrics = { kind: LyricsKind; text?: string };

type LyricsRow = { kind: string; text: string | null };

const LYRICS_KINDS: readonly LyricsKind[] = ['synced', 'plain', 'instrumental', 'none'];

function isLyricsKind(value: string): value is LyricsKind {
  return (LYRICS_KINDS as readonly string[]).includes(value);
}

export async function getCachedLyrics(trackId: string): Promise<CachedLyrics | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await db.getFirstAsync<LyricsRow>(
    'SELECT kind, text FROM lyrics_cache WHERE trackId = ?',
    trackId,
  );
  if (!row || !isLyricsKind(row.kind)) return null;
  return { kind: row.kind, text: orUndefined(row.text) };
}

export async function putCachedLyrics(trackId: string, lyrics: CachedLyrics): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync(
    'INSERT OR REPLACE INTO lyrics_cache (trackId, kind, text, fetchedAt) VALUES (?, ?, ?, ?)',
    trackId,
    lyrics.kind,
    lyrics.text ?? null,
    Date.now(),
  );
}

export async function deleteCachedLyrics(trackId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync('DELETE FROM lyrics_cache WHERE trackId = ?', trackId);
}

export async function countCachedLyrics(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM lyrics_cache WHERE kind IN ('synced', 'plain')",
  );
  return row?.count ?? 0;
}
