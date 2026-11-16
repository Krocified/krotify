import { DatabaseSync } from 'node:sqlite';
import type { MigrationDb } from '../../src/db/migrateV4.ts';

export function createV3Fixture() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  raw.exec(`
    CREATE TABLE playlists (id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt INTEGER NOT NULL, description TEXT, artworkUri TEXT);
    CREATE TABLE playlist_tracks (playlistId TEXT NOT NULL, trackId TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY(playlistId, trackId));
    CREATE TABLE favorites (trackId TEXT PRIMARY KEY, addedAt INTEGER NOT NULL);
    CREATE TABLE play_history (id INTEGER PRIMARY KEY AUTOINCREMENT, trackId TEXT NOT NULL, playedAt INTEGER NOT NULL);
    CREATE TABLE track_metadata (id TEXT PRIMARY KEY, title TEXT, artist TEXT, album TEXT, albumArtist TEXT, year INTEGER, trackNumber INTEGER, discNumber INTEGER, genre TEXT, artworkUri TEXT, explicit INTEGER);
    CREATE TABLE lyrics_cache (trackId TEXT PRIMARY KEY, kind TEXT NOT NULL, text TEXT, fetchedAt INTEGER NOT NULL);
  `);
  const db: MigrationDb = {
    all: async <T>(sql: string, ...params: (string | number | null)[]) =>
      raw.prepare(sql).all(...params) as T[],
    run: async (sql: string, ...params: (string | number | null)[]) =>
      raw.prepare(sql).run(...params),
    exec: async (sql: string) => raw.exec(sql),
  };
  return { raw, db };
}

export type Fixture = ReturnType<typeof createV3Fixture>;

export type MetadataSeed = {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  albumArtist?: string | null;
  year?: number | null;
  trackNumber?: number | null;
  discNumber?: number | null;
  genre?: string | null;
  artworkUri?: string | null;
  explicit?: number | null;
};

export function insertPlaylist(fixture: Fixture): void {
  fixture.raw
    .prepare('INSERT INTO playlists (id, name, createdAt, description, artworkUri) VALUES (?, ?, ?, ?, ?)')
    .run('pl-1', 'Road Trip', 100, 'Driving', 'file:///art/playlist.jpg');
}

export function insertPlaylistTrack(fixture: Fixture, trackId = '12345'): void {
  fixture.raw
    .prepare('INSERT INTO playlist_tracks (playlistId, trackId, position) VALUES (?, ?, ?)')
    .run('pl-1', trackId, 1000);
}

export function insertFavorite(fixture: Fixture, trackId = '12345'): void {
  fixture.raw.prepare('INSERT INTO favorites (trackId, addedAt) VALUES (?, ?)').run(trackId, 200);
}

export function insertPlayHistory(fixture: Fixture, trackId = 'import:legacy'): void {
  fixture.raw
    .prepare('INSERT INTO play_history (trackId, playedAt) VALUES (?, ?)')
    .run(trackId, 300);
}

export function insertLyrics(fixture: Fixture, trackId = '12345'): void {
  fixture.raw
    .prepare('INSERT INTO lyrics_cache (trackId, kind, text, fetchedAt) VALUES (?, ?, ?, ?)')
    .run(trackId, 'plain', 'la la', 400);
}

export function insertMetadata(
  fixture: Fixture,
  id = '12345',
  seed: MetadataSeed = {},
): void {
  fixture.raw
    .prepare(
      `INSERT INTO track_metadata
         (id, title, artist, album, albumArtist, year, trackNumber, discNumber, genre, artworkUri, explicit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      seed.title ?? 'Cached Title',
      seed.artist ?? 'Cached Artist',
      seed.album ?? 'Cached Album',
      seed.albumArtist ?? 'Cached Album Artist',
      seed.year ?? 2001,
      seed.trackNumber ?? 4,
      seed.discNumber ?? 1,
      seed.genre ?? 'Jazz',
      seed.artworkUri ?? 'file:///art/cached.jpg',
      seed.explicit ?? 0,
    );
}

export function seedV3(fixture: Fixture): void {
  insertPlaylist(fixture);
  insertPlaylistTrack(fixture);
  insertFavorite(fixture);
  insertPlayHistory(fixture);
  insertLyrics(fixture);
  insertMetadata(fixture);
}
