import { putScanSummary, type ScanSummary } from '../db/settings.ts';
import {
  getTrack,
  listActiveTracks,
  listRemovedOwnedTracks,
  updateTrackFields,
  upsertScanTracks,
} from './repo.ts';
import { filterScanCandidates, ownedKey } from './scanPlan.ts';
import { readTrackSeed } from './seed.ts';
import { seedToTrackPatch } from './seedMap.ts';
import type { ScanTrackInput, TrackRecord } from './types.ts';

function ownedKeysOf(records: TrackRecord[]): Set<string> {
  const keys = new Set<string>();
  for (const record of records) {
    if (record.source !== 'import' && record.source !== 'download') continue;
    const key = ownedKey(record.fileName, record.sizeBytes);
    if (key !== null) keys.add(key);
  }
  return keys;
}

async function seedInsertedTracks(ids: string[]): Promise<void> {
  let next = 0;

  async function worker(): Promise<void> {
    while (next < ids.length) {
      const index = next;
      next += 1;
      try {
        const record = await getTrack(ids[index]);
        if (!record) continue;
        const seed = await readTrackSeed(record.location);
        await updateTrackFields(
          record.id,
          seedToTrackPatch(seed, record.fileName),
        );
      } catch {
        continue;
      }
    }
  }

  await Promise.all([worker(), worker()]);
}

export async function syncScanResults(
  candidates: ScanTrackInput[],
  options: { rootUri: string | null },
): Promise<{ summary: ScanSummary; skippedOwned: number }> {
  const [active, removed] = await Promise.all([
    listActiveTracks(),
    listRemovedOwnedTracks(),
  ]);
  const ownedKeys = ownedKeysOf([...active, ...removed]);

  const { accepted, skippedOwned } = filterScanCandidates(candidates, {
    rootUri: options.rootUri,
    ownedKeys,
  });

  const { insertedIds, missing } = await upsertScanTracks(accepted);
  await seedInsertedTracks(insertedIds);

  const summary: ScanSummary = {
    lastScanAt: Date.now(),
    found: candidates.length,
    newTracks: insertedIds.length,
    missing,
  };
  await putScanSummary(summary);

  return { summary, skippedOwned };
}
