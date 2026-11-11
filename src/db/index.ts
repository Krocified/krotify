import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { DB_VERSION, SCHEMA_SQL } from './schema';

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) >= DB_VERSION) return;

  await db.withTransactionAsync(async () => {
    await db.execAsync(SCHEMA_SQL);
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
