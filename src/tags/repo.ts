import { getDb } from '../db/index';
import { normalizeTagName } from './name';
import { BULK_ASSIGN_SQL, TAG_ACTIVE_COUNT_SQL, TAG_ASSIGNMENTS_SQL, TAGS_FOR_TRACK_SQL } from './queries';
import type { TagCount } from './filter';

export type Tag = { id: string; name: string };

function newTagId(): string {
  return `tag:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function listTagsWithCounts(): Promise<TagCount[]> {
  const db = await getDb();
  if (!db) return [];
  return db.getAllAsync<TagCount>(TAG_ACTIVE_COUNT_SQL);
}

export async function listTagAssignments(): Promise<{ trackId: string; tagId: string }[]> {
  const db = await getDb();
  if (!db) return [];
  return db.getAllAsync<{ trackId: string; tagId: string }>(TAG_ASSIGNMENTS_SQL);
}

export async function listTagsForTrack(trackId: string): Promise<Tag[]> {
  const db = await getDb();
  if (!db) return [];
  return db.getAllAsync<Tag>(TAGS_FOR_TRACK_SQL, trackId);
}

export async function createTag(rawName: string): Promise<Tag | null> {
  const name = normalizeTagName(rawName);
  if (!name) return null;
  const db = await getDb();
  if (!db) return null;
  const existing = await db.getFirstAsync<Tag>(
    'SELECT id, name FROM tags WHERE name = ? COLLATE NOCASE',
    name,
  );
  if (existing) return existing;
  const id = newTagId();
  await db.runAsync(
    'INSERT OR IGNORE INTO tags (id, name, createdAt) VALUES (?, ?, ?)',
    id,
    name,
    Date.now(),
  );
  return db.getFirstAsync<Tag>('SELECT id, name FROM tags WHERE name = ? COLLATE NOCASE', name);
}

export async function deleteTag(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync('DELETE FROM tags WHERE id = ?', id);
}

export async function assignTag(trackId: string, tagId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync(
    'INSERT OR IGNORE INTO track_tags (trackId, tagId) VALUES (?, ?)',
    trackId,
    tagId,
  );
}

export async function unassignTag(trackId: string, tagId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync('DELETE FROM track_tags WHERE trackId = ? AND tagId = ?', trackId, tagId);
}

export async function assignTagToTracks(
  trackIds: readonly string[],
  tagId: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.withTransactionAsync(async () => {
    for (const trackId of trackIds) await db.runAsync(BULK_ASSIGN_SQL, trackId, tagId);
  });
}

export async function unassignTagFromTracks(
  trackIds: readonly string[],
  tagId: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.withTransactionAsync(async () => {
    for (const trackId of trackIds) {
      await db.runAsync('DELETE FROM track_tags WHERE trackId = ? AND tagId = ?', trackId, tagId);
    }
  });
}
