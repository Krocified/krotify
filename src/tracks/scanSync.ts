import { putScanSummary, type ScanSummary } from '../db/settings.ts';
import {
  getTrack,
  listActiveTracks,
  listHiddenTracks,
  listRemovedOwnedTracks,
  updateTrackFields,
  upsertScanTracks,
} from './repo.ts';
import { filterScanCandidates, ownedKeysOf } from './scanPlan.ts';
import { readTrackSeed } from './seed';
import { seedToTrackPatch } from './seedMap.ts';
import type { ScanTrackInput } from './types.ts';

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
  const [active, removed, hidden] = await Promise.all([
    listActiveTracks(),
    listRemovedOwnedTracks(),
    listHiddenTracks(),
  ]);
  const ownedKeys = ownedKeysOf([...active, ...removed, ...hidden]);

  const { accepted, skippedOwned } = filterScanCandidates(candidates, {
    rootUri: options.rootUri,
    ownedKeys,
  });

  const { insertedIds, missing } = await upsertScanTracks(accepted);
  await seedInsertedTracks(insertedIds);

  const summary: ScanSummary = {
    lastScanAt: Date.now(),
    found: accepted.length,
    newTracks: insertedIds.length,
    missing,
  };
  await putScanSummary(summary);

  return { summary, skippedOwned };
}
