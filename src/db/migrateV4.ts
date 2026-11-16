import { titleFromFilename } from '../lib/format.ts';
import { hueFromSeed } from '../lib/hash.ts';
import type { LegacyExcluded, LegacyImport } from './legacy.ts';
import { V4_TABLE_SQL } from './schema.ts';

export type MigrationDb = {
  all<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
  run(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  exec(sql: string): Promise<void>;
};

export type MigrationInput = {
  fromVersion: number;
  now: number;
  imports: LegacyImport[];
  excluded: LegacyExcluded[];
  fileExists: (location: string) => boolean;
};

export type MigrationResult = {
  importRows: number;
  scanSeeds: number;
  hidden: number;
};

type MetadataRow = {
  id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  genre: string | null;
  artworkUri: string | null;
  explicit: number | null;
};

const TRACK_COLUMNS = `
  id, source, location, fileName, sizeBytes, durationMs, title, artist, album,
  albumArtist, trackNumber, discNumber, year, genre, explicit, artworkUri,
  status, missing, addedAt, lastSeenAt, artworkHue
`;

function fileNameFromUri(uri: string): string {
  const withoutQuery = uri.split(/[?#]/)[0];
  const segment = withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1);
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

async function runChanges(
  db: MigrationDb,
  sql: string,
  ...params: (string | number | null)[]
): Promise<number> {
  const result = await db.run(sql, ...params);
  const changes = (result as { changes?: number | bigint } | null)?.changes;
  return typeof changes === 'bigint' ? Number(changes) : (changes ?? 0);
}

async function insertImport(
  db: MigrationDb,
  record: LegacyImport,
  input: MigrationInput,
): Promise<number> {
  const fileName = fileNameFromUri(record.uri);
  const title = record.title || titleFromFilename(fileName);
  const missing = input.fileExists(record.uri) ? 0 : 1;
  return runChanges(
    db,
    `INSERT OR IGNORE INTO tracks (${TRACK_COLUMNS})
     VALUES (?, 'import', ?, ?, NULL, ?, ?, ?, '', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'active', ?, ?, ?, ?)`,
    record.id,
    record.uri,
    fileName,
    record.durationMs,
    title,
    record.artist,
    missing,
    input.now,
    input.now,
    record.artworkHue ?? hueFromSeed(fileName),
  );
}

async function foldMetadata(
  db: MigrationDb,
  row: MetadataRow,
  now: number,
): Promise<'folded' | 'seeded' | 'skipped'> {
  const existing = await db.all<{ source: string }>('SELECT source FROM tracks WHERE id = ?', row.id);
  if (existing.some((item) => item.source === 'import')) {
    await db.run(
      `UPDATE tracks SET
         album = COALESCE(NULLIF(album, ''), ?),
         albumArtist = COALESCE(albumArtist, ?),
         year = COALESCE(year, ?),
         trackNumber = COALESCE(trackNumber, ?),
         discNumber = COALESCE(discNumber, ?),
         genre = COALESCE(genre, ?),
         artworkUri = COALESCE(artworkUri, ?),
         explicit = COALESCE(explicit, ?)
       WHERE id = ?`,
      row.album,
      row.albumArtist,
      row.year,
      row.trackNumber,
      row.discNumber,
      row.genre,
      row.artworkUri,
      row.explicit,
      row.id,
    );
    return 'folded';
  }
  const inserted = await runChanges(
    db,
    `INSERT OR IGNORE INTO tracks (${TRACK_COLUMNS})
     VALUES (?, 'scan', '', '', NULL, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?)`,
    row.id,
    row.title ?? '',
    row.artist ?? '',
    row.album ?? '',
    row.albumArtist,
    row.trackNumber,
    row.discNumber,
    row.year,
    row.genre,
    row.explicit,
    row.artworkUri,
    now,
    now,
    hueFromSeed(row.id),
  );
  return inserted > 0 ? 'seeded' : 'skipped';
}

async function hideExcluded(
  db: MigrationDb,
  id: string,
  now: number,
): Promise<boolean> {
  const updated = await runChanges(db, "UPDATE tracks SET status = 'hidden' WHERE id = ?", id);
  if (updated > 0) return true;
  const inserted = await runChanges(
    db,
    `INSERT OR IGNORE INTO tracks (${TRACK_COLUMNS})
     VALUES (?, 'scan', '', '', NULL, 0, '', '', '', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'hidden', 1, ?, ?, ?)`,
    id,
    now,
    now,
    hueFromSeed(id),
  );
  return inserted > 0;
}

export async function migrateV3ToV4(
  db: MigrationDb,
  input: MigrationInput,
): Promise<MigrationResult> {
  await db.exec(V4_TABLE_SQL);

  let importRows = 0;
  for (const record of input.imports) {
    importRows += await insertImport(db, record, input);
  }

  let scanSeeds = 0;
  const metadata = await db.all<MetadataRow>(
    `SELECT id, title, artist, album, albumArtist, year, trackNumber, discNumber,
            genre, artworkUri, explicit
       FROM track_metadata`,
  );
  for (const row of metadata) {
    if ((await foldMetadata(db, row, input.now)) === 'seeded') scanSeeds += 1;
  }

  let hidden = 0;
  for (const record of input.excluded) {
    if (await hideExcluded(db, record.id, input.now)) hidden += 1;
  }

  const storageRootKind =
    input.fromVersion > 0 && input.fromVersion < 4 ? 'legacy' : 'krotify';
  await db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    'storageRootKind',
    storageRootKind,
  );

  return { importRows, scanSeeds, hidden };
}
