export const DB_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  createdAt INTEGER NOT NULL
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
  genre TEXT,
  artworkUri TEXT
);
`;
