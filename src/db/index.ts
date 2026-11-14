import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { DB_VERSION, MIGRATION_V2_COLUMNS, SCHEMA_SQL } from './schema';

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) >= DB_VERSION) return;

  await db.withTransactionAsync(async () => {
    await db.execAsync(SCHEMA_SQL);
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(track_metadata)');
    const existing = new Set(columns.map((column) => column.name));
    for (const column of MIGRATION_V2_COLUMNS) {
      if (!existing.has(column.name)) await db.execAsync(column.sql);
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
