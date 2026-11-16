export const DB_VERSION = 4;

export const V4_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK(source IN ('scan', 'import', 'download')),
  location TEXT NOT NULL,
  fileName TEXT NOT NULL,
  sizeBytes INTEGER,
  durationMs INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  artist TEXT NOT NULL DEFAULT '',
  album TEXT NOT NULL DEFAULT '',
  albumArtist TEXT,
  trackNumber INTEGER,
  discNumber INTEGER,
  year INTEGER,
  genre TEXT,
  explicit INTEGER,
  artworkUri TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'hidden', 'removed')),
  missing INTEGER NOT NULL DEFAULT 0,
  addedAt INTEGER NOT NULL,
  lastSeenAt INTEGER NOT NULL,
  artworkHue INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS tracks_location_idx ON tracks(location);
CREATE INDEX IF NOT EXISTS tracks_status_idx ON tracks(status);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS track_tags (
  trackId TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  tagId TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(trackId, tagId)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

const LEGACY_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  description TEXT,
  artworkUri TEXT
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlistId TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  trackId TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY(playlistId, trackId)
);

CREATE TABLE IF NOT EXISTS favorites (
  trackId TEXT PRIMARY KEY,
  addedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS play_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trackId TEXT NOT NULL,
  playedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS play_history_playedAt_idx
  ON play_history(playedAt DESC);

CREATE TABLE IF NOT EXISTS track_metadata (
  id TEXT PRIMARY KEY,
  title TEXT,
  artist TEXT,
  album TEXT,
  albumArtist TEXT,
  year INTEGER,
  trackNumber INTEGER,
  discNumber INTEGER,
  genre TEXT,
  artworkUri TEXT,
  explicit INTEGER
);

CREATE TABLE IF NOT EXISTS lyrics_cache (
  trackId TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  text TEXT,
  fetchedAt INTEGER NOT NULL
);
`;

export const SCHEMA_SQL = `${V4_TABLE_SQL}${LEGACY_TABLE_SQL}`;

export const MIGRATION_V2_COLUMNS = [
  { name: 'discNumber', sql: 'ALTER TABLE track_metadata ADD COLUMN discNumber INTEGER' },
  { name: 'explicit', sql: 'ALTER TABLE track_metadata ADD COLUMN explicit INTEGER' },
] as const;

export function pendingColumnMigrations(existing: Iterable<string>): string[] {
  const names = new Set(existing);
  return MIGRATION_V2_COLUMNS.filter((column) => !names.has(column.name)).map(
    (column) => column.sql,
  );
}

export const MIGRATION_V3_PLAYLIST_COLUMNS = [
  { name: 'description', sql: 'ALTER TABLE playlists ADD COLUMN description TEXT' },
  { name: 'artworkUri', sql: 'ALTER TABLE playlists ADD COLUMN artworkUri TEXT' },
] as const;

export function pendingPlaylistColumnMigrations(existing: Iterable<string>): string[] {
  const names = new Set(existing);
  return MIGRATION_V3_PLAYLIST_COLUMNS.filter((column) => !names.has(column.name)).map(
    (column) => column.sql,
  );
}
