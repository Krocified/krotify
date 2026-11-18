import { Directory, File, Paths } from 'expo-file-system';
import { getDb } from '../db';
import { hashString } from '../lib/hash';

export const ARTIST_ART_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS artist_art (
  artistKey TEXT PRIMARY KEY,
  artworkUri TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);
`;

export const ARTIST_ART_UPSERT_SQL = `
INSERT INTO artist_art (artistKey, artworkUri, updatedAt)
VALUES (?, ?, ?)
ON CONFLICT(artistKey) DO UPDATE SET
  artworkUri = excluded.artworkUri,
  updatedAt = excluded.updatedAt
`;

export const ARTIST_ART_LIST_SQL = 'SELECT artistKey, artworkUri FROM artist_art';

const DIRECTORY_NAME = 'artist-artwork';

function artistDirectory(): Directory {
  const directory = new Directory(Paths.document, DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function fileNamePrefix(artistKey: string): string {
  return `artist-${hashString(artistKey).toString(36)}`;
}

function deleteFilesFor(artistKey: string, keepName?: string): void {
  try {
    const directory = new Directory(Paths.document, DIRECTORY_NAME);
    if (!directory.exists) return;
    const prefix = fileNamePrefix(artistKey);
    for (const entry of directory.list()) {
      if (!(entry instanceof File) || entry.name === keepName) continue;
      if (!entry.name.startsWith(`${prefix}-`)) continue;
      try {
        entry.delete();
      } catch {}
    }
  } catch {}
}

export async function listArtistArt(): Promise<Map<string, string>> {
  const db = await getDb();
  if (!db) return new Map();
  const rows = await db.getAllAsync<{ artistKey: string; artworkUri: string }>(
    ARTIST_ART_LIST_SQL,
  );
  return new Map(rows.map((row) => [row.artistKey, row.artworkUri]));
}

export async function saveArtistArt(artistKey: string, source: File): Promise<string> {
  const directory = artistDirectory();
  const destination = new File(
    directory,
    `${fileNamePrefix(artistKey)}-${Date.now()}.jpg`,
  );
  await source.copy(destination);
  const db = await getDb();
  if (db) {
    await db.runAsync(ARTIST_ART_UPSERT_SQL, artistKey, destination.uri, Date.now());
  }
  deleteFilesFor(artistKey, destination.name);
  return destination.uri;
}

export async function clearArtistArt(artistKey: string): Promise<void> {
  const db = await getDb();
  if (db) await db.runAsync('DELETE FROM artist_art WHERE artistKey = ?', artistKey);
  deleteFilesFor(artistKey);
}
