import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { parseLegacyExcluded, parseLegacyImports } from './legacy';
import { migrateV3ToV4, type MigrationDb } from './migrateV4';
import {
  DB_VERSION,
  pendingColumnMigrations,
  pendingPlaylistColumnMigrations,
  SCHEMA_SQL,
} from './schema';

const IMPORTS_KEY = 'krotify.imports.v1';
const EXCLUDED_KEY = 'krotify.excluded.v1';

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function readLegacy(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

function fileExists(location: string): boolean {
  try {
    return new File(location).exists;
  } catch {
    return false;
  }
}

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const fromVersion = row?.user_version ?? 0;
  if (fromVersion >= DB_VERSION) return;

  const imports = parseLegacyImports(await readLegacy(IMPORTS_KEY));
  const excluded = parseLegacyExcluded(await readLegacy(EXCLUDED_KEY));

  await db.withTransactionAsync(async () => {
    await db.execAsync(SCHEMA_SQL);
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(track_metadata)');
    for (const sql of pendingColumnMigrations(columns.map((column) => column.name))) {
      await db.execAsync(sql);
    }
    const playlistColumns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(playlists)',
    );
    for (const sql of pendingPlaylistColumnMigrations(
      playlistColumns.map((column) => column.name),
    )) {
      await db.execAsync(sql);
    }

    if (fromVersion < 4) {
      const adapter: MigrationDb = {
        all: (sql, ...params) => db.getAllAsync(sql, ...params),
        run: (sql, ...params) => db.runAsync(sql, ...params),
        exec: (sql) => db.execAsync(sql),
      };
      await migrateV3ToV4(adapter, {
        fromVersion,
        now: Date.now(),
        imports,
        excluded,
        fileExists,
      });
    }
  });
  await db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);
}

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync('krotify.db').then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}
